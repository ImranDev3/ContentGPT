'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useChatStore } from '@/lib/store';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveTheme(stored: 'light' | 'dark' | 'system'): Theme {
  if (stored === 'system') {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }
  return stored;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const stored = useChatStore((s) => s.settings.theme);
  const setStored = useChatStore((s) => s.setTheme);
  const [theme, setLocal] = useState<Theme>('light');

  // Apply the resolved theme as a class on <html>.
  useEffect(() => {
    const resolved = resolveTheme(stored);
    setLocal(resolved);
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
  }, [stored]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: (t) => setStored(t),
      toggle: () => setStored(theme === 'dark' ? 'light' : 'dark'),
    }),
    [theme, setStored],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
