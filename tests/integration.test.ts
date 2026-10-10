import { describe, it, expect } from 'vitest';
import { analyzeAutocompleteContext } from '../src/lib/autocomplete/contextAnalyzer';
import { getCompletions } from '../src/lib/autocomplete/completionEngine';
import { parseObjectsFromSource, parseDefinitionsFromSource } from '../src/lib/pikchr';

describe('autocomplete integration', () => {
  it('correctly replaces prefix with selected completion in code', () => {
    const originalCode = 'scale = 0.8\nbo\ncircle "End"';
    const cursor = 'scale = 0.8\nbo'.length; // right after "bo"

    const ctx = analyzeAutocompleteContext(originalCode, cursor)!;
    expect(ctx).not.toBeNull();
    expect(ctx.prefix).toBe('bo');

    const completions = getCompletions(ctx, [], []);
    const boxItem = completions.find(c => c.label === 'box')!;
    expect(boxItem).toBeDefined();

    const newCode = originalCode.substring(0, ctx.replaceStart) + boxItem.insertText + originalCode.substring(ctx.replaceEnd);
    expect(newCode).toBe('scale = 0.8\nbox\ncircle "End"');
  });

  it('correctly replaces dot anchor prefix without duplicating dot', () => {
    const originalCode = 'Server: box "Server"\narrow from Server.e to';
    const cursor = 'Server: box "Server"\narrow from Server.e'.length;

    const ctx = analyzeAutocompleteContext(originalCode, cursor)!;
    expect(ctx).not.toBeNull();
    expect(ctx.contextType).toBe('dot');
    expect(ctx.targetObject).toBe('Server');
    expect(ctx.prefix).toBe('.e');

    const completions = getCompletions(ctx, parseObjectsFromSource(originalCode), []);
    const eastItem = completions.find(c => c.label === '.east')!;
    expect(eastItem).toBeDefined();

    const newCode = originalCode.substring(0, ctx.replaceStart) + eastItem.insertText + originalCode.substring(ctx.replaceEnd);
    expect(newCode).toBe('Server: box "Server"\narrow from Server.east to');
  });

  it('correctly inserts snippet with multiline replacement', () => {
    const originalCode = 'scale = 0.8\ndef';
    const cursor = originalCode.length;

    const ctx = analyzeAutocompleteContext(originalCode, cursor)!;
    expect(ctx).not.toBeNull();

    const completions = getCompletions(ctx, [], []);
    const snippetItem = completions.find(c => c.label.startsWith('define'))!;
    expect(snippetItem).toBeDefined();

    const newCode = originalCode.substring(0, ctx.replaceStart) + snippetItem.insertText + originalCode.substring(ctx.replaceEnd);
    expect(newCode).toContain('define');
  });

  it('suggests dynamically created labels across multiple statements and lines', () => {
    const code = `scale = 0.8
NodeA: box "Node A"
NodeB: circle "Node B" at 2,0
arrow from N`;
    const cursor = code.length;

    const ctx = analyzeAutocompleteContext(code, cursor)!;
    expect(ctx).not.toBeNull();

    const objects = parseObjectsFromSource(code);
    const definitions = parseDefinitionsFromSource(code);
    const completions = getCompletions(ctx, objects, definitions);

    const labels = completions.map(c => c.label);
    expect(labels).toContain('NodeA');
    expect(labels).toContain('NodeB');
  });
});
