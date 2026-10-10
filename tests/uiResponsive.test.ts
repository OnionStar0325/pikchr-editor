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
import { CodeEditorPanel } from '../src/components/CodeEditorPanel';
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
  });
});
