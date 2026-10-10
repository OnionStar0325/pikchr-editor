import { describe, it, expect } from 'vitest';
import { getCompletions, extractDocumentSymbols } from '../src/lib/autocomplete/completionEngine';
import { AnalyzedContext } from '../src/lib/autocomplete/types';
import { PikchrObject, PikchrDefinition } from '../src/lib/types';

describe('completionEngine', () => {
  const mockObjects: PikchrObject[] = [
    {
      id: 'obj_1_1',
      name: 'ServerA',
      labelName: 'ServerA',
      type: 'box',
      lineNumber: 1,
      properties: {},
    },
    {
      id: 'obj_2_2',
      name: 'DatabaseNode',
      labelName: 'DatabaseNode',
      type: 'cylinder',
      lineNumber: 2,
      properties: {},
    },
  ];

  const mockDefinitions: PikchrDefinition[] = [
    {
      id: 'def_1',
      name: '$spacing',
      type: 'variable',
      value: '0.5in',
      lineNumber: 1,
    },
    {
      id: 'def_2',
      name: 'node_macro',
      type: 'macro',
      value: 'box "Node" fit',
      lineNumber: 2,
    },
  ];

  it('extracts document symbols properly from objects and definitions', () => {
    const symbols = extractDocumentSymbols(mockObjects, mockDefinitions);
    const labels = symbols.map(s => s.label);
    expect(labels).toContain('ServerA');
    expect(labels).toContain('DatabaseNode');
    expect(labels).toContain('$spacing');
    expect(labels).toContain('node_macro');
  });

  it('suggests shapes and snippets on stmt_start context', () => {
    const context: AnalyzedContext = {
      contextType: 'stmt_start',
      prefix: 'bo',
      precedingKeywords: ['bo'],
      replaceStart: 0,
      replaceEnd: 2,
    };

    const results = getCompletions(context, mockObjects, mockDefinitions);
    const labels = results.map(r => r.label);

    expect(labels).toContain('box');
    expect(labels).toContain('box "Label" fit');
    expect(labels).toContain('boxwid =');
    expect(labels).toContain('boxht =');
  });

  it('suggests compass anchors on dot context', () => {
    const context: AnalyzedContext = {
      contextType: 'dot',
      prefix: '.n',
      targetObject: 'ServerA',
      precedingKeywords: ['arrow', 'from', 'ServerA.n'],
      replaceStart: 18,
      replaceEnd: 20,
    };

    const results = getCompletions(context, mockObjects, mockDefinitions);
    const labels = results.map(r => r.label);

    expect(labels).toContain('.n');
    expect(labels).toContain('.north');
    expect(labels).toContain('.ne');
    expect(labels).toContain('.nw');
  });

  it('suggests colors and document variables on color context', () => {
    const context: AnalyzedContext = {
      contextType: 'color',
      prefix: 'blu',
      precedingKeywords: ['box', 'fill', 'blu'],
      replaceStart: 9,
      replaceEnd: 12,
    };

    const results = getCompletions(context, mockObjects, mockDefinitions);
    const labels = results.map(r => r.label);

    expect(labels).toContain('blue');
    expect(labels).toContain('blueviolet');
  });

  it('suggests shape properties on shape_attr context', () => {
    const context: AnalyzedContext = {
      contextType: 'shape_attr',
      prefix: 'wi',
      precedingKeywords: ['box', 'wi'],
      replaceStart: 4,
      replaceEnd: 6,
    };

    const results = getCompletions(context, mockObjects, mockDefinitions);
    const labels = results.map(r => r.label);

    expect(labels).toContain('width');
    expect(labels).toContain('wid');
    expect(labels).toContain('with');
  });

  it('suggests path connectors on path context', () => {
    const context: AnalyzedContext = {
      contextType: 'path',
      prefix: 'un',
      precedingKeywords: ['arrow', 'right', '1.0', 'un'],
      replaceStart: 16,
      replaceEnd: 18,
    };

    const results = getCompletions(context, mockObjects, mockDefinitions);
    const labels = results.map(r => r.label);

    expect(labels).toContain('until even with');
    expect(labels).toContain('until');
  });

  it('ranks exact and prefix matches higher', () => {
    const context: AnalyzedContext = {
      contextType: 'stmt_start',
      prefix: 'cir',
      precedingKeywords: ['cir'],
      replaceStart: 0,
      replaceEnd: 3,
    };

    const results = getCompletions(context, mockObjects, mockDefinitions);
    expect(results[0].label).toMatch(/circle/);
  });
});
