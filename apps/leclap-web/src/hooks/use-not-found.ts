import { useMatches } from 'react-router-dom';

/** The catch-all route's handle (App.tsx), so the shared chrome can tell a 404 apart. */
export const NOT_FOUND_HANDLE = { notFound: true } as const;

/**
 * Whether the router fell through to the 404. An address like /studio/nwe starts like the studio but isn't
 * it: the header must not switch to the studio's dark surface over a page that follows the theme, and the
 * studio's first-visit intro must not open over a dead end.
 */
export const useNotFound = (): boolean => useMatches().some((match) => match.handle === NOT_FOUND_HANDLE);
