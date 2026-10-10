import { describe, it, expect, beforeAll } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

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

import { AutocompletePopover } from '../src/components/AutocompletePopover';
import { PaletteSidebar } from '../src/components/PaletteSidebar';
import { ObjectListSidebar } from '../src/components/ObjectListSidebar';
import { CodeEditorPanel, calculateFocusScrollPosition } from '../src/components/CodeEditorPanel';
import { ThemeProvider } from '../src/lib/theme';
import { I18nProvider } from '../src/lib/i18n';
import { CompletionItem } from '../src/lib/autocomplete/types';

describe('Responsive and Resizable UI Components', () => {
  const mockItem: CompletionItem = {
    label: 'box',
    insertText: 'box',
    kind: 'shape',
    detail: 'Box shape',
    documentation: 'Renders a rectangle box',
  };

  it('renders AutocompletePopover within viewport constraints', () => {
    // Normal position inside bounds
    const htmlNormal = renderToString(
      React.createElement(I18nProvider, null,
        React.createElement(AutocompletePopover, {
          isOpen: true,
          items: [mockItem],
          selectedIndex: 0,
          position: { top: 100, left: 150, lineHeight: 20 },
          onSelect: () => {},
          onClose: () => {},
        })
      )
    );
    expect(htmlNormal).toContain('box');
    expect(htmlNormal).toContain('fixed');
    expect(htmlNormal).toContain('top:');
    expect(htmlNormal).toContain('left:');

    // Right-edge overflow position (left: 1150 in a 1200px window)
    const htmlEdge = renderToString(
      React.createElement(I18nProvider, null,
        React.createElement(AutocompletePopover, {
          isOpen: true,
          items: [mockItem],
          selectedIndex: 0,
          position: { top: 700, left: 1150, lineHeight: 20 },
          onSelect: () => {},
          onClose: () => {},
        })
      )
    );
    // Should be clamped to not exceed window.innerWidth - popoverWidth - 12
    expect(htmlEdge).toContain('fixed');
    expect(htmlEdge).toContain('box');
  });

  it('renders PaletteSidebar with custom width prop', () => {
    const html = renderToString(
      React.createElement(I18nProvider, null,
        React.createElement(PaletteSidebar, {
          width: 350,
          definitions: [],
          onInsertSnippet: () => {},
          onSelectLine: () => {},
          onDeleteLine: () => {},
        })
      )
    );
    expect(html).toContain('width:350px');
  });

  it('renders ObjectListSidebar with custom width prop', () => {
    const html = renderToString(
      React.createElement(I18nProvider, null,
        React.createElement(ObjectListSidebar, {
          width: 420,
          objects: [],
          definitions: [],
          selectedLine: null,
          selectedObjectId: null,
          activeTargetField: null,
          setActiveTargetField: () => {},
          refInsertion: null,
          onSelectObject: () => {},
          onUpdateObject: () => {},
          onDeleteObject: () => {},
        })
      )
    );
    expect(html).toContain('width:420px');
  });

  it('renders CodeEditorPanel with custom height prop and mobile full mode', () => {
    // Custom height mode
    const htmlHeight = renderToString(
      React.createElement(I18nProvider, null,
        React.createElement(CodeEditorPanel, {
          code: 'box "Hello"',
          onChangeCode: () => {},
          selectedLine: null,
          selectedObjectId: null,
          objects: [],
          definitions: [],
          onSelectLine: () => {},
          compileResult: { success: true, svgHtml: '', error: null, durationMs: 1 },
          isExpanded: false,
          onToggleExpand: () => {},
          onCommitHistory: () => {},
          onUndo: () => {},
          onRedo: () => {},
          height: 250,
        })
      )
    );
    expect(htmlHeight).toContain('height:250px');

    // Mobile full mode
    const htmlMobileFull = renderToString(
      React.createElement(I18nProvider, null,
        React.createElement(CodeEditorPanel, {
          code: 'box "Hello"',
          onChangeCode: () => {},
          selectedLine: null,
          selectedObjectId: null,
          objects: [],
          definitions: [],
          onSelectLine: () => {},
          compileResult: { success: true, svgHtml: '', error: null, durationMs: 1 },
          isExpanded: false,
          onToggleExpand: () => {},
          onCommitHistory: () => {},
          onUndo: () => {},
          onRedo: () => {},
          isMobileFull: true,
        })
      )
    );
    expect(htmlMobileFull).toContain('flex-1 h-full w-full');
    expect(htmlMobileFull).toContain('min-h-0');
    expect(htmlMobileFull).toContain('padding-bottom:220px');
  });

  it('renders autocomplete toggle checkbox in CodeEditorPanel header', () => {
    const html = renderToString(
      React.createElement(I18nProvider, null,
        React.createElement(CodeEditorPanel, {
          code: 'box "Hello"',
          onChangeCode: () => {},
          selectedLine: null,
          selectedObjectId: null,
          objects: [],
          definitions: [],
          onSelectLine: () => {},
          compileResult: { success: true, svgHtml: '', error: null, durationMs: 1 },
          isExpanded: false,
          onToggleExpand: () => {},
          onCommitHistory: () => {},
          onUndo: () => {},
          onRedo: () => {},
        })
      )
    );
    // Check that checkbox input is rendered
    expect(html).toContain('type="checkbox"');
    // Check that Korean i18n label for autocomplete is rendered
    expect(html).toContain('자동완성 컨텍스트 표시');
  });

  it('renders "수정됨" clickable button when code is modified before rendering', () => {
    // 1. Not modified: renders "문법 검증 완료"
    const htmlUnmodified = renderToString(
      React.createElement(I18nProvider, null,
        React.createElement(CodeEditorPanel, {
          code: 'box "Hello"',
          onChangeCode: () => {},
          selectedLine: null,
          selectedObjectId: null,
          objects: [],
          definitions: [],
          onSelectLine: () => {},
          compileResult: { success: true, svgHtml: '', error: null, durationMs: 1 },
          isExpanded: false,
          onToggleExpand: () => {},
          isModified: false,
        })
      )
    );
    expect(htmlUnmodified).toContain('문법 검증 완료');
    expect(htmlUnmodified).not.toContain('수정됨');

    // 2. Modified: renders "수정됨" clickable button
    const htmlModified = renderToString(
      React.createElement(I18nProvider, null,
        React.createElement(CodeEditorPanel, {
          code: 'box "Hello" 123',
          onChangeCode: () => {},
          selectedLine: null,
          selectedObjectId: null,
          objects: [],
          definitions: [],
          onSelectLine: () => {},
          compileResult: { success: true, svgHtml: '', error: null, durationMs: 1 },
          isExpanded: false,
          onToggleExpand: () => {},
          isModified: true,
          onRenderNow: () => {},
        })
      )
    );
    expect(htmlModified).toContain('수정됨');
    expect(htmlModified).not.toContain('문법 검증 완료');
  });

  describe('Mobile Layout Key Input Auto-Scrolling to Focus Position', () => {
    const multiLineCode = [
      'box "Line 1"',
      'arrow "Line 2"',
      'circle "Line 3"',
      'box "Line 4"',
      'arrow "Line 5"',
      'circle "Line 6"',
      'box "Line 7"',
      'arrow "Line 8"',
      'circle "Line 9"',
      'box "Line 10"',
      'arrow "Line 11"',
      'circle "Line 12"',
      'box "Line 13"',
      'arrow "Line 14"',
      'circle "Line 15"',
      'box "Line 16"',
      'arrow "Line 17"',
      'circle "Line 18"',
      'box "Line 19"',
      'circle "Line 20"',
    ].join('\n');

    it('keeps current scroll position when cursor is inside the safe visible viewport', () => {
      // Line 5 is at targetTop = 10 + 4*20 = 90.
      // With scrollTop = 0 and clientHeight = 200:
      // Safe visible range is [20, 150]. 90 is inside.
      const line5Start = multiLineCode.indexOf('arrow "Line 5"');
      const result = calculateFocusScrollPosition({
        cursor: line5Start,
        text: multiLineCode,
        scrollTop: 0,
        scrollLeft: 0,
        clientHeight: 200,
        clientWidth: 300,
      });

      expect(result.isScrolledVertically).toBe(false);
      expect(result.nextScrollTop).toBeUndefined();
    });

    it('scrolls down towards center when cursor is below the bottom buffer', () => {
      // Line 18 is at targetTop = 10 + 17*20 = 350, targetBottom = 370.
      // With scrollTop = 0 and clientHeight = 200:
      // 370 > 0 + 200 - 50 = 150, so it triggers downward scroll.
      const line18Start = multiLineCode.indexOf('circle "Line 18"');
      const result = calculateFocusScrollPosition({
        cursor: line18Start,
        text: multiLineCode,
        scrollTop: 0,
        scrollLeft: 0,
        clientHeight: 200,
        clientWidth: 300,
      });

      expect(result.isScrolledVertically).toBe(true);
      // Expected: Math.max(0, 350 - 100) = 250
      expect(result.nextScrollTop).toBe(250);
    });

    it('scrolls up towards center when cursor is above the top buffer', () => {
      // Line 2 is at targetTop = 10 + 1*20 = 30.
      // If user scrolled down to scrollTop = 300:
      // 30 < 300 + 20 = 320, so it triggers upward scroll.
      const line2Start = multiLineCode.indexOf('arrow "Line 2"');
      const result = calculateFocusScrollPosition({
        cursor: line2Start,
        text: multiLineCode,
        scrollTop: 300,
        scrollLeft: 0,
        clientHeight: 200,
        clientWidth: 300,
      });

      expect(result.isScrolledVertically).toBe(true);
      // Expected: Math.max(0, 30 - 100) = 0
      expect(result.nextScrollTop).toBe(0);
    });

    it('adjusts horizontal scroll when typing extends beyond right edge of mobile viewport', () => {
      const longLine = 'box "This is a very long line of code that extends far beyond the mobile viewport width"';
      const result = calculateFocusScrollPosition({
        cursor: longLine.length,
        text: longLine,
        scrollTop: 0,
        scrollLeft: 0,
        clientHeight: 200,
        clientWidth: 250,
      });

      expect(result.isScrolledHorizontally).toBe(true);
      expect(result.nextScrollLeft).toBeGreaterThan(0);
    });

    it('resets horizontal scroll when cursor moves back to start of line', () => {
      const longLine = 'box "This is a very long line of code that extends far beyond the mobile viewport width"';
      const result = calculateFocusScrollPosition({
        cursor: 0,
        text: longLine,
        scrollTop: 0,
        scrollLeft: 300,
        clientHeight: 200,
        clientWidth: 250,
      });

      expect(result.isScrolledHorizontally).toBe(true);
      expect(result.nextScrollLeft).toBe(0);
    });
  });
});
