import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'night-pm-theme';

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {}
  return 'dark';
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

// Apply immediately on module load so there's no flash before the first render.
applyTheme(getInitialTheme());

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  // On mount, reconcile localStorage with the persisted app setting as a fallback.
  useEffect(() => {
    if (!window.nightAPI) return;
    window.nightAPI.settings.get().then((settings) => {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      // Only use the settings value if localStorage has nothing.
      if (!stored && (settings.theme === 'light' || settings.theme === 'dark')) {
        setThemeState(settings.theme);
        localStorage.setItem(STORAGE_KEY, settings.theme);
        applyTheme(settings.theme);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
    // Persist to app settings so it survives a fresh profile.
    window.nightAPI?.settings.set({ theme: t }).catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme };
}
