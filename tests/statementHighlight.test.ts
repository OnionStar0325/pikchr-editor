import { describe, it, expect, beforeAll } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { parseObjectsFromSource, compilePikchr, extractConnectorPath, updateMultiLineStatement } from '../src/lib/pikchr';
import { EXAMPLES } from '../src/lib/examples';
import { CodeEditorPanel, shouldDeselectOnEmptyLine } from '../src/components/CodeEditorPanel';
import { ObjectListSidebar } from '../src/components/ObjectListSidebar';
import { I18nProvider } from '../src/lib/i18n';

beforeAll(() => {
  const storage: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => storage[key] ?? null,
    setItem: (key: string, val: string) => { storage[key] = val; },
    removeItem: (key: string) => { delete storage[key]; },
    clear: () => {},
  };
  (globalThis as any).window = globalThis;
  (globalThis as any).window.innerWidth = 1200;
  (globalThis as any).window.innerHeight = 800;
  (globalThis as any).window.matchMedia = () => ({
    matches: false,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  (globalThis as any).navigator = {
    language: 'ko-KR',
    clipboard: { writeText: async () => {} },
  };
});

describe('Statement Highlight and Inline Statements (box; box; box;)', () => {
  it('correctly parses individual startChar and endChar for inline statements', () => {
    const code = 'box; box; box;';
    const objs = parseObjectsFromSource(code);
    expect(objs).toHaveLength(3);

    expect(objs[0].id).toBe('obj_1_1');
    expect(objs[0].startChar).toBe(0);
    expect(objs[0].endChar).toBe(3);

    expect(objs[1].id).toBe('obj_1_2');
    expect(objs[1].startChar).toBe(5);
    expect(objs[1].endChar).toBe(8);

    expect(objs[2].id).toBe('obj_1_3');
    expect(objs[2].startChar).toBe(10);
    expect(objs[2].endChar).toBe(13);
  });

  it('tags distinct data-obj-id in SVG output for inline statements', async () => {
    const code = 'box; box; box;';
    const result = await compilePikchr(code);
    expect(result.success).toBe(true);
    expect(result.svgHtml).toContain('data-obj-id="obj_1_1"');
    expect(result.svgHtml).toContain('data-obj-id="obj_1_2"');
    expect(result.svgHtml).toContain('data-obj-id="obj_1_3"');
  });

  it('renders character-level token highlight for the selected object on the same line', () => {
    const code = 'box; box; box;';
    const objs = parseObjectsFromSource(code);

    // Render with 2nd box selected
    const htmlSecondSelected = renderToString(
      React.createElement(I18nProvider, null,
        React.createElement(CodeEditorPanel, {
          code,
          onChangeCode: () => {},
          selectedLine: 1,
          selectedObjectId: 'obj_1_2',
          objects: objs,
          definitions: [],
          onSelectLine: () => {},
          compileResult: { success: true, svgHtml: '', error: null, durationMs: 1 },
          isExpanded: false,
          onToggleExpand: () => {},
        })
      )
    );

    // Must contain token-level highlight badge class
    expect(htmlSecondSelected).toContain('ring-blue-500/60');
    expect(htmlSecondSelected).toContain('bg-blue-500/25');
  });

  it('preserves unmanaged modifiers such as "same" and "behind" in extraModifiers', () => {
    const code = 'box same "Parser"\nbox same behind Box1 "Analyzer"';
    const objs = parseObjectsFromSource(code);
    expect(objs).toHaveLength(2);

    expect(objs[0].label).toBe('Parser');
    expect(objs[0].properties.extraModifiers).toBe('same');

    expect(objs[1].label).toBe('Analyzer');
    expect(objs[1].properties.extraModifiers).toBe('same behind Box1');
  });

  it('preserves shape keyword in relative references such as "same as 1st box"', () => {
    const code = 'UT: box same as 1st box at (Tokenizer,Pager) "Utilities"';
    const objs = parseObjectsFromSource(code);
    expect(objs).toHaveLength(1);

    expect(objs[0].labelName).toBe('UT');
    expect(objs[0].label).toBe('Utilities');
    expect(objs[0].properties.at).toBe('(Tokenizer,Pager)');
    expect(objs[0].properties.extraModifiers).toBe('same as 1st box');
  });

  it('correctly associates character ranges and lines for labeled statement followed by arrow (Bug 1)', () => {
    const code = `In: box "Interface" wid 150% ht 75% fill white
    arrow`;
    const objs = parseObjectsFromSource(code);
    expect(objs).toHaveLength(2);

    const boxObj = objs[0];
    const arrowObj = objs[1];

    expect(boxObj.type).toBe('box');
    expect(boxObj.labelName).toBe('In');
    expect(boxObj.label).toBe('Interface');
    expect(boxObj.lineNumber).toBe(1);
    expect(boxObj.startChar).toBe(0);
    // Entire statement including "In: box ... fill white" should be covered
    expect(boxObj.endChar).toBeGreaterThanOrEqual(46);

    expect(arrowObj.type).toBe('arrow');
    expect(arrowObj.lineNumber).toBe(2);

    // Any cursor position on line 1 (e.g. index 3 to 8, and index 9 or beyond)
    // falls strictly within boxObj's character range [0, 46] and not arrowObj
    for (let col = 0; col <= 46; col++) {
      expect(col >= boxObj.startChar && col <= boxObj.endChar).toBe(true);
      expect(col >= arrowObj.startChar).toBe(false);
    }
  });

  it('correctly extracts italic, invis, and aligned properties on multi-line statements (Bug 2)', () => {
    const code = `line invis from 0.25*$margin west of last.se up last.ht \\
      "Accessories" italic aligned`;
    const objs = parseObjectsFromSource(code);
    expect(objs).toHaveLength(1);

    const lineObj = objs[0];
    expect(lineObj.type).toBe('line');
    expect(lineObj.properties.invis).toBe(true);
    expect(lineObj.label).toBe('Accessories');
    expect(lineObj.properties.textStyle).toBe('italic');
    expect(lineObj.properties.textPosition).toBe('aligned');

    // Verify extractConnectorPath strips invis and labels accurately
    const path = extractConnectorPath(lineObj.rawStatement, lineObj.type);
    expect(path).toBe('from 0.25*$margin west of last.se up last.ht');
  });

  describe('updateMultiLineStatement - Multi-line structure preservation and row deletion', () => {
    it('preserves multi-line structure when changing an existing property value', () => {
      const code = `box "Interface" \\
    wid 150% ht 75% \\
    fill white`;
      const objs = parseObjectsFromSource(code);
      expect(objs).toHaveLength(1);

      // Change fill from white to yellow
      const updated = updateMultiLineStatement(
        objs[0].rawStatement,
        objs[0],
        { fill: 'yellow' }
      );

      const expected = `box "Interface" \\
    wid 150% ht 75% \\
    fill yellow`;
      expect(updated).toBe(expected);
    });

    it('deletes a row when all attributes on that row are removed', () => {
      const code = `box "Interface" \\
    wid 150% ht 75% \\
    fill white`;
      const objs = parseObjectsFromSource(code);
      expect(objs).toHaveLength(1);

      // Deleting fill removes the 3rd row, and removes backslash from the new last row (2nd row)
      const updated = updateMultiLineStatement(
        objs[0].rawStatement,
        objs[0],
        { fill: '' }
      );

      const expected = `box "Interface" \\
    wid 150% ht 75%`;
      expect(updated).toBe(expected);
    });

    it('preserves a row if other attributes remain when one attribute on that row is removed', () => {
      const code = `box "Interface" \\
    wid 150% ht 75% \\
    fill white`;
      const objs = parseObjectsFromSource(code);
      expect(objs).toHaveLength(1);

      // Deleting wid leaves ht 75% on the 2nd row, so the row is preserved
      const updated = updateMultiLineStatement(
        objs[0].rawStatement,
        objs[0],
        { width: '' }
      );

      const expected = `box "Interface" \\
    ht 75% \\
    fill white`;
      expect(updated).toBe(expected);
    });

    it('preserves multi-line structure when adding a new property such as thick to a multi-line connector', () => {
      const code = `line invis from 0.25*$margin west of last.se up last.ht \\
      "Accessories" italic aligned`;
      const objs = parseObjectsFromSource(code);
      expect(objs).toHaveLength(1);

      // Adding thickness 'thick' appends to the last line while preserving 2-line structure and indent
      const updated = updateMultiLineStatement(
        objs[0].rawStatement,
        objs[0],
        { thickness: 'thick' }
      );

      const expected = `line invis from 0.25*$margin west of last.se up last.ht \\
      "Accessories" italic aligned thick`;
      expect(updated).toBe(expected);
    });

    it('deletes intermediate row when a middle row attribute is removed', () => {
      const code = `box "Title" \\
    wid 200% \\
    fill red`;
      const objs = parseObjectsFromSource(code);
      expect(objs).toHaveLength(1);

      // Deleting wid removes row 2
      const updated = updateMultiLineStatement(
        objs[0].rawStatement,
        objs[0],
        { width: '' }
      );

      const expected = `box "Title" \\
    fill red`;
      expect(updated).toBe(expected);
    });

    it('preserves delimiter space between at attribute and next attribute (Pager fill bug)', () => {
      const code = `    box ht (BT.n.y-OS.s.y)+$margin wid In.wid+$margin \\
       at Pager fill 0xd0ece8 behind In`;
      const objs = parseObjectsFromSource(code);
      expect(objs).toHaveLength(1);

      // Re-committing or updating "at" attribute with "Pager"
      const updated = updateMultiLineStatement(
        objs[0].rawStatement,
        objs[0],
        { at: 'Pager' }
      );

      const expected = `box ht (BT.n.y-OS.s.y)+$margin wid In.wid+$margin \\
       at Pager fill 0xd0ece8 behind In`;
      expect(updated).toBe(expected);
      // Ensure "Pagerfill" does not occur
      expect(updated).not.toContain('Pagerfill');
      expect(updated).toContain('at Pager fill');

      // Verify that in the entire code string, leading indentation and trailing content are preserved
      const newCode = code.substring(0, objs[0].startChar) + updated + code.substring(objs[0].endChar);
      expect(newCode).toBe(code);
    });

    it('correctly updates at attribute when trailing thick keyword is present', () => {
      const code = `box ht (BT.n.y-OS.s.y)+$margin wid In.wid+$margin \\
       at Pager fill 0xd0ece8 behind In thick`;
      const objs = parseObjectsFromSource(code);
      expect(objs).toHaveLength(1);

      // Change at to Pager.c
      const updated = updateMultiLineStatement(
        objs[0].rawStatement,
        objs[0],
        { at: 'Pager.c' }
      );

      const expected = `box ht (BT.n.y-OS.s.y)+$margin wid In.wid+$margin \\
       at Pager.c fill 0xd0ece8 behind In thick`;
      expect(updated).toBe(expected);
      expect(updated).toContain('at Pager.c fill 0xd0ece8 behind In thick');
    });

    it('preserves multi-strings and keyword synonyms when adding dashed to single-line statement', () => {
      const code = 'CG: box same ht 200% "Code" "Generator"';
      const objs = parseObjectsFromSource(code);
      expect(objs).toHaveLength(1);

      // Add dashed
      const updated = updateMultiLineStatement(
        objs[0].rawStatement,
        objs[0],
        { dash: 'dashed' }
      );

      // Expected: "Code" "Generator" and ht 200% must be preserved, dashed added
      expect(updated).toBe('CG: box same ht 200% "Code" "Generator" dashed');
    });

    it('preserves ht synonym and multi-strings when updating height on single-line statement', () => {
      const code = 'CG: box same ht 200% "Code" "Generator"';
      const objs = parseObjectsFromSource(code);
      expect(objs).toHaveLength(1);

      // Change height to 150%
      const updated = updateMultiLineStatement(
        objs[0].rawStatement,
        objs[0],
        { height: '150%' }
      );

      expect(updated).toBe('CG: box same ht 150% "Code" "Generator"');
    });

    it('preserves existing synonym keywords: wid, width, rad, radius, diam, diameter, invis, invisible', () => {
      // wid
      const widObj = parseObjectsFromSource('box wid 150% ht 75%')[0];
      expect(updateMultiLineStatement(widObj.rawStatement, widObj, { width: '180%' })).toBe('box wid 180% ht 75%');

      // width
      const widthObj = parseObjectsFromSource('box width 150% height 75%')[0];
      expect(updateMultiLineStatement(widthObj.rawStatement, widthObj, { width: '180%' })).toBe('box width 180% height 75%');

      // rad vs radius
      const radObj = parseObjectsFromSource('circle rad 10px')[0];
      expect(updateMultiLineStatement(radObj.rawStatement, radObj, { radius: '15px' })).toBe('circle rad 15px');

      const radiusObj = parseObjectsFromSource('circle radius 10px')[0];
      expect(updateMultiLineStatement(radiusObj.rawStatement, radiusObj, { radius: '15px' })).toBe('circle radius 15px');

      // diam vs diameter
      const diamObj = parseObjectsFromSource('circle diam 20px')[0];
      expect(updateMultiLineStatement(diamObj.rawStatement, diamObj, { diameter: '25px' })).toBe('circle diam 25px');

      const diameterObj = parseObjectsFromSource('circle diameter 20px')[0];
      expect(updateMultiLineStatement(diameterObj.rawStatement, diameterObj, { diameter: '25px' })).toBe('circle diameter 25px');

      // invis vs invisible
      const invisObj = parseObjectsFromSource('line invis from A to B')[0];
      expect(updateMultiLineStatement(invisObj.rawStatement, invisObj, { thickness: 'thick' })).toBe('line invis from A to B thick');

      const invisibleObj = parseObjectsFromSource('line invisible from A to B')[0];
      expect(updateMultiLineStatement(invisibleObj.rawStatement, invisibleObj, { thickness: 'thick' })).toBe('line invisible from A to B thick');
    });

    it('preserves separate text string literals when only text modifiers are updated', () => {
      const code = 'box "Code" "Generator"';
      const objs = parseObjectsFromSource(code);

      const updated = updateMultiLineStatement(
        objs[0].rawStatement,
        objs[0],
        { textStyle: 'italic' }
      );

      expect(updated).toBe('box "Code" "Generator" italic');
    });

    it('synchronizes SVG data-obj-id with objects list for all behind boxes in SQLite Architecture', async () => {
      const code = EXAMPLES[0].code;
      const objs = parseObjectsFromSource(code);
      const compileResult = await compilePikchr(code);
      expect(compileResult.success).toBe(true);

      const behindBoxLines = [29, 34, 39, 44];
      for (const line of behindBoxLines) {
        const obj = objs.find(o => o.lineNumber === line);
        expect(obj).toBeDefined();
        expect(obj?.type).toBe('box');

        // Verify that SVG contains exact data-obj-id corresponding to the object's id
        expect(compileResult.svgHtml).toContain(`data-obj-id="${obj!.id}"`);
      }
    });

    it('maintains exact SVG data-obj-id tagging when a new statement is inserted in the middle of code', async () => {
      const baseCode = `box "First"
arrow
box "Second"
arrow
box "Third"`;

      // Insert statement in the middle (between arrow and Second)
      const codeWithMiddle = `box "First"
arrow
circle "Middle"
box "Second"
arrow
box "Third"`;

      const objs = parseObjectsFromSource(codeWithMiddle);
      const res = await compilePikchr(codeWithMiddle);
      expect(res.success).toBe(true);

      for (const obj of objs) {
        expect(res.svgHtml).toContain(`data-obj-id="${obj.id}"`);
      }

      // Verify text tag semantic match
      const textMatches = [...res.svgHtml.matchAll(/<text[^>]*data-obj-id="([^"]+)"[^>]*>([^<]+)<\/text>/g)];
      expect(textMatches.length).toBe(4);
      expect(textMatches.find(m => m[2] === 'First')?.[1]).toBe(objs.find(o => o.label === 'First')?.id);
      expect(textMatches.find(m => m[2] === 'Middle')?.[1]).toBe(objs.find(o => o.label === 'Middle')?.id);
      expect(textMatches.find(m => m[2] === 'Second')?.[1]).toBe(objs.find(o => o.label === 'Second')?.id);
      expect(textMatches.find(m => m[2] === 'Third')?.[1]).toBe(objs.find(o => o.label === 'Third')?.id);
    });

    it('does not corrupt SVG tagging when an invisible shape without text is inserted in the middle', async () => {
      const code = `box "A"
line invis
box "B"
box "C"`;

      const objs = parseObjectsFromSource(code);
      const res = await compilePikchr(code);
      expect(res.success).toBe(true);

      // Verify that Box B's path and text are both tagged with Box B's ID, not line invis
      const boxB = objs.find(o => o.label === 'B')!;
      const boxC = objs.find(o => o.label === 'C')!;
      expect(boxB).toBeDefined();
      expect(boxC).toBeDefined();

      const boxBMatches = [...res.svgHtml.matchAll(new RegExp(`data-obj-id="${boxB.id}"`, 'g'))];
      const boxCMatches = [...res.svgHtml.matchAll(new RegExp(`data-obj-id="${boxC.id}"`, 'g'))];

      expect(boxBMatches.length).toBe(2); // 1 path + 1 text
      expect(boxCMatches.length).toBe(2); // 1 path + 1 text
    });

    it('maintains exact SVG tagging when a statement is inserted before behind boxes in SQLite Architecture', async () => {
      const modifiedCode = `box "Top Banner"\n` + EXAMPLES[0].code;
      const objs = parseObjectsFromSource(modifiedCode);
      const res = await compilePikchr(modifiedCode);
      expect(res.success).toBe(true);

      // Verify Top Banner has its own elements
      const topObj = objs.find(o => o.lineNumber === 1)!;
      expect(topObj).toBeDefined();
      expect(res.svgHtml).toContain(`data-obj-id="${topObj.id}"`);

      // Verify that all behind boxes and texts are correctly matched
      const coreTextObj = objs.find(o => o.label === 'Core')!;
      expect(coreTextObj).toBeDefined();
      expect(res.svgHtml).toContain(`data-obj-id="${coreTextObj.id}"`);
      const coreTextMatch = [...res.svgHtml.matchAll(/<text[^>]*data-obj-id="([^"]+)"[^>]*>Core<\/text>/g)];
      expect(coreTextMatch.length).toBe(1);
      expect(coreTextMatch[0][1]).toBe(coreTextObj.id);
    });

    it('does not render items count badge on the right side of STATEMENTS sidebar header', () => {
      const code = 'box "A"\narrow\nbox "B"';
      const objs = parseObjectsFromSource(code);

      const html = renderToString(
        React.createElement(I18nProvider, null,
          React.createElement(ObjectListSidebar, {
            objects: objs,
            selectedLine: 1,
            selectedObjectId: objs[0].id,
            onSelectObject: () => {},
            onUpdateObject: () => {},
            onDeleteObject: () => {},
          })
        )
      );

      // Verify STATEMENTS title exists
      expect(html).toContain('STATEMENTS');
      // Verify right-side "items" / "개" badge is removed
      expect(html).not.toMatch(/>\s*\d+\s*(?:items|개)\s*</i);
    });

    describe('Empty line block deselection logic (shouldDeselectOnEmptyLine)', () => {
      it('returns true to deselect active block when moving to an empty line without backslash continuation', () => {
        const lines = ['box "A"', ''];
        // Cursor on line 2 (empty line), previous line has no '\'
        expect(shouldDeselectOnEmptyLine(lines, 2)).toBe(true);
      });

      it('returns false when cursor is on an empty line whose previous line ends with continuation backslash', () => {
        const lines = ['box ht 20 \\', ''];
        // Cursor on line 2 (empty line), but previous line ends with '\'
        expect(shouldDeselectOnEmptyLine(lines, 2)).toBe(false);
      });

      it('returns false when cursor is on a line with non-whitespace text', () => {
        const lines = ['box "A"', 'arrow'];
        expect(shouldDeselectOnEmptyLine(lines, 2)).toBe(false);
        expect(shouldDeselectOnEmptyLine(lines, 1)).toBe(false);
      });

      it('returns true when the first line is empty', () => {
        const lines = ['', 'box "A"'];
        expect(shouldDeselectOnEmptyLine(lines, 1)).toBe(true);
      });

      it('correctly detects trailing comments vs actual backslashes', () => {
        // Line with comment ending in backslash is NOT a continuation line
        const linesWithComment = ['box "A" // some backslash \\', ''];
        expect(shouldDeselectOnEmptyLine(linesWithComment, 2)).toBe(true);

        // Line with backslash followed by comment IS a continuation line
        const linesWithBackslashAndComment = ['box "A" \\ # continuing line', ''];
        expect(shouldDeselectOnEmptyLine(linesWithBackslashAndComment, 2)).toBe(false);
      });
    });
  });
});



