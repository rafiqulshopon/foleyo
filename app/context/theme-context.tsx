'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const STORAGE_KEY = 'foleyo_theme';

// Safe default for SSR / before provider mounts
const DEFAULT_THEME: ThemeContextType = {
  theme: 'dark',
  toggleTheme: () => {},
};

export function useTheme() {
  const ctx = useContext(ThemeContext);
  return ctx ?? DEFAULT_THEME;
}

/**
 * Read the theme the blocking script in layout.tsx already applied to <html>.
 * That attribute is the source of truth for the initial render, so the
 * provider's first client render matches what is on screen — no flash, no
 * mounted gate.
 */
function readInitialTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  // Apply and persist whenever the theme changes
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
