// Tema claro/escuro. Toggle binário: 'light' | 'dark'.
// A classe `.dark` no <html> é a fonte da verdade visual (ver index.css).
// O FOUC é evitado por um script inline em index.html que roda antes do React.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Icon } from './icons.tsx';
import { cn } from './ui.tsx';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

const prefersDark = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

// Primeira carga sem preferência salva: segue o SO. Depois sempre o que o
// usuário escolheu no toggle.
const readStored = (): Theme => {
  const v = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  if (v === 'light' || v === 'dark') return v;
  return prefersDark() ? 'dark' : 'light';
};

// Reflete o tema na <html>: classe .dark + meta theme-color.
function applyTheme(theme: Theme): void {
  const dark = theme === 'dark';
  document.documentElement.classList.toggle('dark', dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0e111b' : '#ffffff');
}

type Ctx = { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void };
const ThemeContext = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [theme, setThemeState] = useState<Theme>(readStored);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
    applyTheme(t);
  }, []);

  const toggle = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme]);

  // garante que o DOM reflita o estado inicial (caso difira do script anti-FOUC)
  useEffect(() => { applyTheme(theme); }, [theme]);

  const value = useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Ctx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme deve ser usado dentro de <ThemeProvider>');
  return ctx;
}

// Switch deslizante claro↔escuro. `variant` casa com as duas top bars.
export function ThemeToggle({ variant = 'light' }: { variant?: 'light' | 'dark' }): React.JSX.Element {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      onClick={toggle}
      aria-label={dark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      title={dark ? 'Tema escuro' : 'Tema claro'}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
        variant === 'dark' ? 'focus-visible:ring-offset-ink-900' : 'focus-visible:ring-offset-surface',
        dark ? 'bg-brand-600' : variant === 'dark' ? 'bg-white/20' : 'bg-ink-200',
      )}
    >
      <span
        className={cn(
          'grid h-5 w-5 place-items-center rounded-full bg-surface text-ink-600 shadow transition-transform',
          dark ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      >
        <Icon name={dark ? 'moon' : 'sun'} size={12} />
      </span>
    </button>
  );
}
