export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'leclap-theme';

/** Current theme, derived from the `.dark` class set on <html> (see index.html). */
export const getTheme = (): Theme => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');

/** Apply a theme to <html> and persist the choice. */
export const setTheme = (theme: Theme): void => {
  document.documentElement.classList.toggle('dark', theme === 'dark');

  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* storage may be unavailable (private mode) — theme still applies for the session */
  }
};

/** The theme the user explicitly picked, or null while they're still on the system default. */
export const getStoredTheme = (): Theme | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    return null;
  }
};

/**
 * Keep the app on the OS color scheme while the user hasn't chosen a theme of their own — the
 * default is "follow system preference". Re-applies on every OS change until a stored choice exists
 * (a toggle persists one), then stops overriding it. `onChange` lets a caller mirror the resolved
 * theme into React state. Returns an unsubscribe function.
 */
export const watchSystemTheme = (onChange?: (theme: Theme) => void): (() => void) => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const media = window.matchMedia('(prefers-color-scheme: dark)');

  const apply = (): void => {
    if (getStoredTheme() !== null) {
      return;
    }

    const theme: Theme = media.matches ? 'dark' : 'light';
    document.documentElement.classList.toggle('dark', theme === 'dark');
    onChange?.(theme);
  };

  media.addEventListener('change', apply);

  return () => {
    media.removeEventListener('change', apply);
  };
};

const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/** Origin point (viewport coords) the dark/light wipe expands from. */
export type ToggleOrigin = { x: number; y: number };

/**
 * The View Transitions API isn't in TS's DOM lib yet — declare the minimal
 * surface we use and feature-detect via this cast (no bare `any`).
 */
// The DOM lib now types Document.startViewTransition as always-present, but it's a progressive
// API absent in older browsers — Omit it so the runtime feature-detect below stays meaningful.
type VTDocument = Omit<Document, 'startViewTransition'> & {
  startViewTransition?: (cb: () => void) => { ready: Promise<void> };
};

/** Largest distance from the origin to any of the 4 viewport corners. */
const maxCornerRadius = (x: number, y: number): number => {
  const right = window.innerWidth;
  const bottom = window.innerHeight;

  return Math.max(
    Math.hypot(x, y),
    Math.hypot(right - x, y),
    Math.hypot(x, bottom - y),
    Math.hypot(right - x, bottom - y)
  );
};

/**
 * Flip the theme and return the new value.
 *
 * When the View Transitions API is available (and motion is allowed), the new
 * theme is revealed with a circular clip-path wipe expanding from `origin`
 * (defaults to viewport center). Otherwise falls back to the brief color
 * cross-fade. The new `Theme` is returned synchronously regardless.
 */
export const toggleTheme = (origin?: ToggleOrigin): Theme => {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark';
  const root = document.documentElement;
  const doc = document as VTDocument;

  if (doc.startViewTransition && !prefersReducedMotion()) {
    const x = origin?.x ?? window.innerWidth / 2;
    const y = origin?.y ?? window.innerHeight / 2;
    const r = maxCornerRadius(x, y);

    root.style.setProperty('--vt-x', `${x}px`);
    root.style.setProperty('--vt-y', `${y}px`);
    root.style.setProperty('--vt-r', `${r}px`);
    // Marks this transition as the theme wipe so the scoped CSS in index.css
    // disables the default cross-fade (route changes keep their slide/fade).
    root.classList.add('theme-vt');

    const transition = doc.startViewTransition(() => {
      setTheme(next);
    });

    // Animate the NEW snapshot's clip-path once the transition is ready. Run
    // detached so `next` is returned immediately for synchronous callers.
    (async () => {
      try {
        await transition.ready;
        const wipe = root.animate(
          {
            clipPath: ['circle(0px at var(--vt-x) var(--vt-y))', 'circle(var(--vt-r) at var(--vt-x) var(--vt-y))'],
          },
          {
            duration: 450,
            easing: 'ease-in-out',
            pseudoElement: '::view-transition-new(root)',
          }
        );
        await wipe.finished;
      } catch {
        /* transition skipped/aborted — the theme has already been applied */
      } finally {
        root.classList.remove('theme-vt');
      }
    })().catch(() => {});

    return next;
  }

  // Fallback: brief color cross-fade via the `.theme-transition` class.
  if (!prefersReducedMotion()) {
    root.classList.add('theme-transition');
    window.setTimeout(() => {
      root.classList.remove('theme-transition');
    }, 360);
  }
  setTheme(next);

  return next;
};
