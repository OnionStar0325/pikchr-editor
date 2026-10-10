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

import App from '../src/App';
import { ThemeProvider } from '../src/lib/theme';
import { I18nProvider } from '../src/lib/i18n';

describe('App Component', () => {
  it('renders without throwing', () => {
    expect(() => {
      renderToString(
        React.createElement(ThemeProvider, null,
          React.createElement(I18nProvider, null,
            React.createElement(App)
          )
        )
      );
    }).not.toThrow();
  });
});
