import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

export const useTheme = () => {
  const { theme, setTheme } = useAppStore();

  useEffect(() => {
    const root = document.documentElement;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    const handleThemeChange = () => {
      if (theme === 'system') {
        applyTheme(prefersDark.matches);
      } else {
        applyTheme(theme === 'dark');
      }
    };

    handleThemeChange();

    // Listen for system theme changes
    if (theme === 'system') {
      prefersDark.addEventListener('change', handleThemeChange);
      return () => prefersDark.removeEventListener('change', handleThemeChange);
    }
  }, [theme]);

  return { theme, setTheme };
};
