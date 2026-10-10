import React, { useState, useRef, useEffect } from 'react';
import { 
  Code2, 
  Copy, 
  Check, 
  FileCode,
  Layout,
  Trash2, 
  ChevronDown,
  Globe,
  HelpCircle,
  Sun,
  Moon,
  Undo2,
  Redo2
} from 'lucide-react';
import { EXAMPLES } from '../lib/examples';
import { useTranslation, SupportedLocale } from '../lib/i18n';
import { useTheme } from '../lib/theme';

interface MenuBarProps {
  onNewDiagram: () => void;
  onLoadTemplate: (code: string) => void;
  onExportSvg: () => void;
  onExportPng: () => void;
  onCopyCode: () => void;
  onInsertSnippet: (snippet: string) => void;
  onClearAll: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onToggleEditor: () => void;
  onOpenHelp: () => void;
  isCopied: boolean;
  compileSuccess: boolean;
  durationMs: number;
}

export const MenuBar: React.FC<MenuBarProps> = ({
  onNewDiagram,
  onLoadTemplate,
  onExportSvg,
  onExportPng,
  onCopyCode,
  onInsertSnippet,
  onClearAll,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onToggleEditor,
  onOpenHelp,
  isCopied,
  compileSuccess,
  durationMs,
}) => {
  const { t, locale, setLocale } = useTranslation();
  const { theme, toggleTheme, setTheme } = useTheme();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMenuClick = (menuName: string) => {
    setActiveMenu(prev => (prev === menuName ? null : menuName));
  };

  const handleAction = (action: () => void) => {
    action();
    setActiveMenu(null);
  };

  const languageLabels: Record<SupportedLocale, string> = {
    ko: '한국어 (KO)',
    en: 'English (EN)',
    ja: '日本語 (JA)',
  };

  return (
    <nav 
      ref={menuRef} 
      className="h-10 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-3 flex items-center justify-between shrink-0 select-none z-50 text-xs text-slate-700 dark:text-slate-200 transition-colors"
    >
      {/* Left: Brand + Desktop Menu Bar */}
      <div className="flex items-center space-x-1">
        {/* App Logo */}
        <div className="flex items-center space-x-2 mr-1 sm:mr-3 px-1.5 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="w-4 h-4 rounded bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shrink-0">
            <Code2 className="w-3 h-3 text-white" />
          </div>
          <span className="font-bold tracking-wider text-[11px] text-slate-900 dark:text-slate-100 hidden sm:inline">{t.menu.brand}</span>
        </div>

        {/* 1. File Menu */}
        <div className="relative">
          <button
            onClick={() => handleMenuClick('file')}
            className={`px-2.5 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition ${
              activeMenu === 'file' ? 'bg-slate-200 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-semibold' : ''
            }`}
          >
            {t.menu.file}
          </button>
          {activeMenu === 'file' && (
            <div className="absolute left-0 mt-1 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl py-1.5 z-50">
              <button
                onClick={() => handleAction(onNewDiagram)}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-between"
              >
                <span>{t.menu.new}</span>
              </button>
              <div className="my-1 border-t border-slate-200 dark:border-slate-800" />
              <button
                onClick={() => handleAction(onCopyCode)}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>{t.menu.copySource}</span>
                </div>
              </button>
              <button
                onClick={() => handleAction(onExportSvg)}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center space-x-2"
              >
                <FileCode className="w-3.5 h-3.5 text-blue-500" />
                <span>{t.menu.exportSvg}</span>
              </button>
              <button
                onClick={() => handleAction(onExportPng)}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center space-x-2"
              >
                <Layout className="w-3.5 h-3.5 text-emerald-500" />
                <span>{t.menu.exportPng}</span>
              </button>
            </div>
          )}
        </div>

        {/* 2. Edit Menu */}
        <div className="relative">
          <button
            onClick={() => handleMenuClick('edit')}
            className={`px-2.5 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition ${
              activeMenu === 'edit' ? 'bg-slate-200 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-semibold' : ''
            }`}
          >
            {t.menu.edit}
          </button>
          {activeMenu === 'edit' && (
            <div className="absolute left-0 mt-1 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl py-1.5 z-50">
              <button
                onClick={() => handleAction(onUndo)}
                disabled={!canUndo}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:hover:bg-transparent flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <Undo2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>{t.menu.undo}</span>
                </div>
              </button>
              <button
                onClick={() => handleAction(onRedo)}
                disabled={!canRedo}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:hover:bg-transparent flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <Redo2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>{t.menu.redo}</span>
                </div>
              </button>
              <div className="my-1 border-t border-slate-200 dark:border-slate-800" />
              <button
                onClick={() => handleAction(onClearAll)}
                className="w-full text-left px-3 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-rose-600 dark:text-rose-300 flex items-center space-x-2"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>{t.menu.clearAll}</span>
              </button>
            </div>
          )}
        </div>

        {/* 3. Examples Menu */}
        <div className="relative">
          <button
            onClick={() => handleMenuClick('examples')}
            className={`px-2.5 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition flex items-center space-x-1 ${
              activeMenu === 'examples' ? 'bg-slate-200 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-semibold' : ''
            }`}
          >
            <span>{t.menu.examples}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
          {activeMenu === 'examples' && (
            <div className="absolute left-0 mt-1 w-80 md:w-96 max-w-[90vw] max-h-[calc(100vh-3.5rem)] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl py-1.5 z-50 divide-y divide-slate-100 dark:divide-slate-800/60">
              {EXAMPLES.map(ex => (
                <button
                  key={ex.id}
                  onClick={() => handleAction(() => onLoadTemplate(ex.code))}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-blue-50/60 dark:hover:bg-blue-600/10 text-slate-700 dark:text-slate-200 flex flex-col gap-0.5 transition min-w-0"
                >
                  <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">{ex.name}</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal whitespace-normal break-words">{ex.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 5. View Menu */}
        <div className="relative">
          <button
            onClick={() => handleMenuClick('view')}
            className={`px-2.5 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition ${
              activeMenu === 'view' ? 'bg-slate-200 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-semibold' : ''
            }`}
          >
            {t.menu.view}
          </button>
          {activeMenu === 'view' && (
            <div className="absolute left-0 mt-1 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl py-1.5 z-50">
              <button
                onClick={() => handleAction(onToggleEditor)}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                {t.menu.toggleEditor}
              </button>
              <div className="my-1 border-t border-slate-200 dark:border-slate-800" />
              <button
                onClick={() => handleAction(() => setTheme('light'))}
                className={`w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between ${
                  theme === 'light' ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-500/10' : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span>{t.menu.themeLight}</span>
                </div>
                {theme === 'light' && <Check className="w-3 h-3 text-blue-600" />}
              </button>
              <button
                onClick={() => handleAction(() => setTheme('dark'))}
                className={`w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between ${
                  theme === 'dark' ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-500/10' : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Moon className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{t.menu.themeDark}</span>
                </div>
                {theme === 'dark' && <Check className="w-3 h-3 text-blue-400" />}
              </button>
            </div>
          )}
        </div>

        {/* 6. Help Menu */}
        <div className="relative">
          <button
            onClick={() => handleMenuClick('help')}
            className={`px-2.5 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition ${
              activeMenu === 'help' ? 'bg-slate-200 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-semibold' : ''
            }`}
          >
            {t.menu.help}
          </button>
          {activeMenu === 'help' && (
            <div className="absolute left-0 mt-1 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl py-1.5 z-50">
              <button
                onClick={() => handleAction(onOpenHelp)}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center space-x-2"
              >
                <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
                <span>{t.menu.syntaxGuide}</span>
              </button>
            </div>
          )}
        </div>

        {/* Quick Undo / Redo Toolbar */}
        <div className="flex items-center space-x-0.5 ml-2 pl-2 border-l border-slate-200 dark:border-slate-800">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title={t.menu.undo}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent text-slate-700 dark:text-slate-300 transition"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title={t.menu.redo}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent text-slate-700 dark:text-slate-300 transition"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Right: Language Selector + Theme Toggle + Status Indicator & Action Buttons */}
      <div className="flex items-center space-x-2">
        {/* Quick Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? t.menu.themeLight : t.menu.themeDark}
          className="p-1.5 rounded bg-white dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 transition shadow-2xs flex items-center justify-center"
        >
          {theme === 'dark' ? (
            <Sun className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-indigo-600" />
          )}
        </button>

        {/* Language Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => handleMenuClick('language')}
            className={`flex items-center space-x-1.5 px-2 py-1 rounded bg-white dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-[11px] transition shadow-2xs ${
              activeMenu === 'language' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-blue-500" />
            <span>{locale.toUpperCase()}</span>
            <ChevronDown className="w-2.5 h-2.5 text-slate-400" />
          </button>
          {activeMenu === 'language' && (
            <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl py-1 z-50">
              {(['ko', 'en', 'ja'] as SupportedLocale[]).map(lang => (
                <button
                  key={lang}
                  onClick={() => {
                    setLocale(lang);
                    setActiveMenu(null);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 transition ${
                    locale === lang ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-500/10' : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span>{languageLabels[lang]}</span>
                  {locale === lang && <Check className="w-3 h-3 text-blue-500" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Compilation Status Pill */}
        <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] shadow-2xs">
          <div className={`w-2 h-2 rounded-full ${compileSuccess ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
          <span className="font-mono text-slate-700 dark:text-slate-300">
            {compileSuccess ? `${t.common.wasmTime} (${durationMs}ms)` : t.common.error}
          </span>
        </div>

        {/* Copy Button */}
        <button
          onClick={onCopyCode}
          className="hidden sm:flex items-center space-x-1 px-2.5 py-1 rounded bg-white dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 transition shadow-2xs"
        >
          {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{isCopied ? t.common.copied : t.common.copy}</span>
        </button>

        {/* Export SVG */}
        <button
          onClick={onExportSvg}
          className="flex items-center space-x-1 px-2 sm:px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-[11px] transition shadow"
        >
          <FileCode className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">{t.common.download}</span>
        </button>
      </div>
    </nav>
  );
};
