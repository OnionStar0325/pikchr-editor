import { describe, it, expect, beforeAll } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { parseObjectsFromSource, compilePikchr } from '../src/lib/pikchr';
import { CodeEditorPanel } from '../src/components/CodeEditorPanel';
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
});
