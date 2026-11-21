import { createContext, useContext, useEffect, useState } from 'react';
import i18n from '../i18n';

const LanguageContext = createContext();
const DEFAULT_LANGUAGE = 'pl';
const AVAILABLE_LANGUAGES = ['pl', 'en', 'uk'];

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    const savedLanguage = localStorage.getItem('ls-language');
    return AVAILABLE_LANGUAGES.includes(savedLanguage)
      ? savedLanguage
      : DEFAULT_LANGUAGE;
  });

  useEffect(() => {
    i18n.changeLanguage(language);
    localStorage.setItem('ls-language', language);
  }, [language]);

  function setLanguage(newLanguage) {
    if (!AVAILABLE_LANGUAGES.includes(newLanguage)) return;
    setLanguageState((current) =>
      current === newLanguage ? current : newLanguage
    );
  }

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        languages: AVAILABLE_LANGUAGES,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error('useLanguage must be used inside LanguageProvider');
  }

  return context;
}
