import React, { createContext, useContext, useState, useEffect } from 'react';

export type AppTheme = 'dark' | 'light';
export type CanvasBackground = 'paper-white' | 'paper-dark' | 'transparent';

interface ThemeContextType {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
  canvasBg: CanvasBackground;
  setCanvasBg: (bg: CanvasBackground) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const THEME_STORAGE_KEY = 'pikchr_studio_theme';
const CANVAS_BG_STORAGE_KEY = 'pikchr_studio_canvas_bg';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as AppTheme | null;
    if (saved && (saved === 'dark' || saved === 'light')) {
      return saved;
    }
    // 기본 테마를 라이트/다크 감지 (기본은 식별성이 뛰어난 dark UI에 라이트 캔버스 또는 라이트 테마)
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  const [canvasBg, setCanvasBgState] = useState<CanvasBackground>(() => {
    const saved = localStorage.getItem(CANVAS_BG_STORAGE_KEY) as CanvasBackground | null;
    if (saved && ['paper-white', 'paper-dark', 'transparent'].includes(saved)) {
      return saved;
    }
    // 다이어그램 식별이 가장 선명한 기본값: paper-white
    return 'paper-white';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = (newTheme: AppTheme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setCanvasBg = (bg: CanvasBackground) => {
    setCanvasBgState(bg);
    localStorage.setItem(CANVAS_BG_STORAGE_KEY, bg);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, canvasBg, setCanvasBg }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
