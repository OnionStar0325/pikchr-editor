import { describe, it, expect } from 'vitest';
import {
  SHAPE_COMPLETIONS,
  DIRECTION_COMPLETIONS,
  PROPERTY_COMPLETIONS,
  ANCHOR_COMPLETIONS,
  COLOR_COMPLETIONS,
  MATH_FUNCTION_COMPLETIONS,
  SNIPPET_COMPLETIONS,
} from '../src/lib/autocomplete/pikchrDictionary';

describe('pikchrDictionary', () => {
  it('contains all 15 Pikchr shape types', () => {
    const expectedShapes = [
      'box', 'circle', 'arrow', 'line', 'cylinder',
      'diamond', 'oval', 'ellipse', 'file', 'dot',
      'text', 'move', 'spline', 'arc', 'block'
    ];
    const shapeLabels = SHAPE_COMPLETIONS.map(s => s.label);
    expectedShapes.forEach(shape => {
      expect(shapeLabels).toContain(shape);
    });
  });

  it('contains cardinal and ordinal compass anchors', () => {
    const expectedAnchors = [
      '.c', '.center', '.n', '.north', '.ne',
      '.e', '.east', '.se', '.s', '.south',
      '.sw', '.w', '.west', '.nw', '.t', '.top',
      '.bot', '.bottom', '.start', '.end'
    ];
    const anchorLabels = ANCHOR_COMPLETIONS.map(a => a.label);
    expectedAnchors.forEach(anchor => {
      expect(anchorLabels).toContain(anchor);
    });
  });

  it('contains all standard HTML color names plus None and Off', () => {
    const colorLabels = COLOR_COMPLETIONS.map(c => c.label);
    expect(colorLabels).toContain('red');
    expect(colorLabels).toContain('blue');
    expect(colorLabels).toContain('green');
    expect(colorLabels).toContain('lightblue');
    expect(colorLabels).toContain('crimson');
    expect(colorLabels).toContain('None');
    expect(colorLabels).toContain('Off');
    expect(colorLabels.length).toBeGreaterThanOrEqual(140);
  });

  it('contains valid snippet templates with non-empty insertText', () => {
    expect(SNIPPET_COMPLETIONS.length).toBeGreaterThan(0);
    SNIPPET_COMPLETIONS.forEach(snippet => {
      expect(snippet.label.length).toBeGreaterThan(0);
      expect(snippet.insertText.length).toBeGreaterThan(0);
      expect(snippet.kind).toBe('snippet');
    });
  });

  it('contains math functions', () => {
    const fnLabels = MATH_FUNCTION_COMPLETIONS.map(f => f.label);
    expect(fnLabels).toContain('abs()');
    expect(fnLabels).toContain('cos()');
    expect(fnLabels).toContain('sin()');
    expect(fnLabels).toContain('sqrt()');
    expect(fnLabels).toContain('dist(a, b)');
  });
});
