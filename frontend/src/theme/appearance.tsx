/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type AppearanceMode = 'light' | 'dark' | 'system';
export type ResolvedColorScheme = 'light' | 'dark';
export type ThemeId = 'default';

export const APPEARANCE_STORAGE_KEY = 'openhands-client-appearance-mode';
export const THEME_ID: ThemeId = 'default';
export const COLOR_SCHEME_ATTRIBUTE = 'data-color-scheme';
export const THEME_ATTRIBUTE = 'data-theme';

const DEFAULT_APPEARANCE_MODE: AppearanceMode = 'system';
const SYSTEM_QUERY = '(prefers-color-scheme: dark)';

type AppearanceContextValue = {
  mode: AppearanceMode;
  resolvedColorScheme: ResolvedColorScheme;
  themeId: ThemeId;
  setMode: (mode: AppearanceMode) => void;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function isAppearanceMode(value: string | null): value is AppearanceMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function parseAppearanceMode(value: string | null): AppearanceMode {
  return isAppearanceMode(value) ? value : DEFAULT_APPEARANCE_MODE;
}

export function resolveColorScheme(
  mode: AppearanceMode,
  systemColorScheme: ResolvedColorScheme,
): ResolvedColorScheme {
  return mode === 'system' ? systemColorScheme : mode;
}

function readStoredMode(): AppearanceMode {
  if (typeof window === 'undefined') return DEFAULT_APPEARANCE_MODE;

  try {
    return parseAppearanceMode(window.localStorage.getItem(APPEARANCE_STORAGE_KEY));
  } catch {
    return DEFAULT_APPEARANCE_MODE;
  }
}

function readSystemColorScheme(): ResolvedColorScheme {
  if (typeof window === 'undefined') return 'light';

  return window.matchMedia(SYSTEM_QUERY).matches ? 'dark' : 'light';
}

export function applyResolvedColorScheme(colorScheme: ResolvedColorScheme) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.setAttribute(COLOR_SCHEME_ATTRIBUTE, colorScheme);
  root.setAttribute(THEME_ATTRIBUTE, THEME_ID);
  root.style.colorScheme = colorScheme;
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AppearanceMode>(readStoredMode);
  const [systemColorScheme, setSystemColorScheme] = useState<ResolvedColorScheme>(
    readSystemColorScheme,
  );

  const resolvedColorScheme = resolveColorScheme(mode, systemColorScheme);

  useEffect(() => {
    if (typeof window === 'undefined' || mode !== 'system') return;

    const mediaQuery = window.matchMedia(SYSTEM_QUERY);
    const onChange = (event: MediaQueryListEvent) =>
      setSystemColorScheme(event.matches ? 'dark' : 'light');

    setSystemColorScheme(mediaQuery.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, [mode]);

  useEffect(() => {
    applyResolvedColorScheme(resolvedColorScheme);
  }, [resolvedColorScheme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(APPEARANCE_STORAGE_KEY, mode);
    } catch {
      // Keep the UI usable in privacy-restricted browser contexts.
    }
  }, [mode]);

  const value = useMemo<AppearanceContextValue>(
    () => ({
      mode,
      resolvedColorScheme,
      themeId: THEME_ID,
      setMode,
    }),
    [mode, resolvedColorScheme],
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  const context = useContext(AppearanceContext);

  if (!context) {
    throw new Error('useAppearance must be used inside <AppearanceProvider>.');
  }

  return context;
}
