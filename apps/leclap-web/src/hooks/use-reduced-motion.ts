import { useMediaQuery } from './use-media-query';

/** Whether the visitor asked for reduced motion — live, so flipping the OS setting applies at once. */
export const useReducedMotion = (): boolean => useMediaQuery('(prefers-reduced-motion: reduce)');
