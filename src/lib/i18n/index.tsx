import React, { createContext, useContext, useState, useEffect } from 'react';
import { SupportedLocale, TranslationDictionary } from './types';
import { ko } from './ko';
import { en } from './en';
import { ja } from './ja';

const dictionaries: Record<SupportedLocale, TranslationDictionary> = {
  ko,
  en,
  ja,
};

interface I18nContextType {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: TranslationDictionary;
}

const I18nContext = createContext<I18nContextType | null>(null);

const STORAGE_KEY = 'pikchr_studio_locale';

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as SupportedLocale | null;
    if (saved && ['ko', 'en', 'ja'].includes(saved)) {
      return saved;
    }
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith('ko')) return 'ko';
    if (browserLang.startsWith('ja')) return 'ja';
    return 'en';
  });

  const setLocale = (newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    localStorage.setItem(STORAGE_KEY, newLocale);
  };

  const t = dictionaries[locale] || dictionaries.ko;

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
};

export * from './types';
