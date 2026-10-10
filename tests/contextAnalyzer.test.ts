import { describe, it, expect } from 'vitest';
import { analyzeAutocompleteContext } from '../src/lib/autocomplete/contextAnalyzer';

describe('contextAnalyzer', () => {
  it('identifies stmt_start at the beginning of empty input', () => {
    const ctx = analyzeAutocompleteContext('', 0);
    expect(ctx).not.toBeNull();
    expect(ctx?.contextType).toBe('stmt_start');
    expect(ctx?.prefix).toBe('');
  });

  it('identifies stmt_start when typing a shape name at start of line', () => {
    const code = 'bo';
    const ctx = analyzeAutocompleteContext(code, 2);
    expect(ctx).not.toBeNull();
    expect(ctx?.contextType).toBe('stmt_start');
    expect(ctx?.prefix).toBe('bo');
    expect(ctx?.replaceStart).toBe(0);
    expect(ctx?.replaceEnd).toBe(2);
  });

  it('identifies stmt_start after semicolon', () => {
    const code = 'box; ci';
    const ctx = analyzeAutocompleteContext(code, code.length);
    expect(ctx).not.toBeNull();
    expect(ctx?.contextType).toBe('stmt_start');
    expect(ctx?.prefix).toBe('ci');
    expect(ctx?.replaceStart).toBe(5);
    expect(ctx?.replaceEnd).toBe(7);
  });

  it('identifies shape_attr after shape name', () => {
    const code = 'box wid';
    const ctx = analyzeAutocompleteContext(code, code.length);
    expect(ctx).not.toBeNull();
    expect(ctx?.contextType).toBe('shape_attr');
    expect(ctx?.prefix).toBe('wid');
    expect(ctx?.precedingKeywords).toContain('box');
  });

  it('identifies dot context and extracts target object for BoxA.', () => {
    const code = 'arrow from BoxA.';
    const ctx = analyzeAutocompleteContext(code, code.length);
    expect(ctx).not.toBeNull();
    expect(ctx?.contextType).toBe('dot');
    expect(ctx?.targetObject).toBe('BoxA');
    expect(ctx?.prefix).toBe('.');
  });

  it('identifies dot context with partial anchor BoxA.ne', () => {
    const code = 'arrow from BoxA.ne';
    const ctx = analyzeAutocompleteContext(code, code.length);
    expect(ctx).not.toBeNull();
    expect(ctx?.contextType).toBe('dot');
    expect(ctx?.targetObject).toBe('BoxA');
    expect(ctx?.prefix).toBe('.ne');
  });

  it('identifies color context after fill and color keywords', () => {
    const code1 = 'box fill cr';
    const ctx1 = analyzeAutocompleteContext(code1, code1.length);
    expect(ctx1).not.toBeNull();
    expect(ctx1?.contextType).toBe('color');
    expect(ctx1?.prefix).toBe('cr');

    const code2 = 'color = lig';
    const ctx2 = analyzeAutocompleteContext(code2, code2.length);
    expect(ctx2).not.toBeNull();
    expect(ctx2?.contextType).toBe('color');
    expect(ctx2?.prefix).toBe('lig');
  });

  it('identifies path context after from/to/then', () => {
    const code = 'arrow from previous.e to ';
    const ctx = analyzeAutocompleteContext(code, code.length);
    expect(ctx).not.toBeNull();
    expect(ctx?.contextType).toBe('path');
  });

  it('identifies relative context after same as or behind', () => {
    const code = 'box same as ';
    const ctx = analyzeAutocompleteContext(code, code.length);
    expect(ctx).not.toBeNull();
    expect(ctx?.contextType).toBe('relative');
  });

  it('returns null when cursor is inside comments', () => {
    const code1 = '// this is a comment with bo';
    expect(analyzeAutocompleteContext(code1, code1.length)).toBeNull();

    const code2 = '# pikchr comment bo';
    expect(analyzeAutocompleteContext(code2, code2.length)).toBeNull();

    const code3 = '/* multi line comment bo */';
    expect(analyzeAutocompleteContext(code3, 10)).toBeNull();
  });
});
