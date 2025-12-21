import React, { createContext, useContext, useCallback } from 'react';
import { Language } from '@/types';
import { getTranslation, TranslationKey } from './translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  children: React.ReactNode;
}

export function LanguageProvider({ language, setLanguage, children }: LanguageProviderProps) {
  const t = useCallback((key: TranslationKey) => {
    return getTranslation(language, key);
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export function useTranslation() {
  const { t, language } = useLanguage();
  return { t, language };
}
