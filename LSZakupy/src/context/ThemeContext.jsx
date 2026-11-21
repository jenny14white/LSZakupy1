import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

const DEFAULT_THEME = 'dark-ember';

const AVAILABLE_THEMES = [
  'dark-ember',
  'navy',
  'forest',
  'gold',
  'crimson',
  'blossom',
  'violet',
];

function getInitialTheme() {
  try {
    const savedTheme = localStorage.getItem('ls-theme');

    return AVAILABLE_THEMES.includes(savedTheme) ? savedTheme : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);

    document.documentElement.style.colorScheme =
      theme === 'dark-ember' || theme === 'crimson' ? 'dark' : 'light';

    try {
      localStorage.setItem('ls-theme', theme);
    } catch {
      return;
    }
  }, [theme]);

  function setTheme(newTheme) {
    if (!AVAILABLE_THEMES.includes(newTheme)) {
      return;
    }

    setThemeState(newTheme);
  }

  function toggleTheme() {
    setThemeState((currentTheme) => {
      const currentIndex = AVAILABLE_THEMES.indexOf(currentTheme);

      const nextIndex = (currentIndex + 1) % AVAILABLE_THEMES.length;

      return AVAILABLE_THEMES[nextIndex];
    });
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        themes: AVAILABLE_THEMES,
        defaultTheme: DEFAULT_THEME,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme musi być używany wewnątrz ThemeProvider.');
  }

  return context;
}
