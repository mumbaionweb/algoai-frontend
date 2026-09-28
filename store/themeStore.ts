import { create } from 'zustand';

export type ThemeType = 'dark' | 'light' | 'solarized-light';

interface ThemeState {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
}

export const useThemeStore = create<ThemeState>((set) => {
  // Read initial theme from localStorage if in client environment
  let initialTheme: ThemeType = 'dark';
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('algoai_theme') as ThemeType;
    if (saved === 'dark' || saved === 'light' || saved === 'solarized-light') {
      initialTheme = saved;
    }
  }

  return {
    theme: initialTheme,
    setTheme: (theme: ThemeType) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('algoai_theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
      }
      set({ theme });
    },
  };
});
