export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'leclap-theme'

/** Current theme, derived from the `.dark` class set on <html> (see index.html). */
export const getTheme = (): Theme =>
  document.documentElement.classList.contains('dark') ? 'dark' : 'light'

/** Apply a theme to <html> and persist the choice. */
export const setTheme = (theme: Theme): void => {
  document.documentElement.classList.toggle('dark', theme === 'dark')

  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* storage may be unavailable (private mode) — theme still applies for the session */
  }
}

const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') {
    return false
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Flip the theme (with a brief juicy color cross-fade) and return the new value. */
export const toggleTheme = (): Theme => {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark'
  const root = document.documentElement

  if (!prefersReducedMotion()) {
    root.classList.add('theme-transition')
    window.setTimeout(() => { root.classList.remove('theme-transition') }, 360)
  }
  setTheme(next)

  return next
}
