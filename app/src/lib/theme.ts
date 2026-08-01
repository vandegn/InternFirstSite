export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'internfirst-dark-mode';

/**
 * Applies the theme by stamping `data-theme` on <html>. All theming lives in
 * globals.css under `[data-theme="dark"]`, so this is the only switch needed.
 */
export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
}

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return localStorage.getItem(THEME_STORAGE_KEY) === 'true' ? 'dark' : 'light';
}

export function setStoredTheme(theme: Theme) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(THEME_STORAGE_KEY, (theme === 'dark').toString());
}

/**
 * Persists and applies in one step, and notifies any other mounted component
 * (e.g. a second settings page in another tab) via a custom event.
 */
export function setTheme(theme: Theme) {
  setStoredTheme(theme);
  applyTheme(theme);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<Theme>('internfirst-theme-change', { detail: theme }));
  }
}

/**
 * Inlined in <head> so the correct theme is painted on the very first frame.
 * Without this the page flashes light before hydration.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var d=localStorage.getItem('${THEME_STORAGE_KEY}')==='true'?'dark':'light';document.documentElement.setAttribute('data-theme',d);document.documentElement.style.colorScheme=d;}catch(e){}})();`;
