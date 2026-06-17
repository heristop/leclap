// Shared bits for the animation-overlay picker + its drag/resize frame canvas. Kept separate so both
// components import from here (no import cycle).
import type { Orientation } from '../templateEditorModel';

export type PreviewBg = 'checker' | 'dark' | 'light';

export const PREVIEW_BG_CLASS: Record<PreviewBg, string> = {
  checker:
    'bg-[repeating-conic-gradient(#e5e7eb_0_25%,#f3f4f6_0_50%)] bg-[length:14px_14px] dark:bg-[repeating-conic-gradient(#27272a_0_25%,#18181b_0_50%)]',
  dark: 'bg-zinc-900',
  light: 'bg-white',
};

// The output frame the descriptor's position/scale px are measured against (matches the engine's
// default video scale per orientation).
export const FRAME_SIZE: Record<Orientation, { w: number; h: number }> = {
  landscape: { w: 1280, h: 720 },
  portrait: { w: 720, h: 1280 },
};

export const clamp = (value: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, value));

// Parse a "a:b" descriptor pair into its two raw string sides (empty when unset).
export const parsePair = (value: string | undefined): [string, string] => {
  const [a = '', b = ''] = (value ?? '').split(':');

  return [a, b];
};

// "" for both → undefined (use the descriptor default); otherwise an empty side reads as 0.
export const formatPair = (a: string, b: string): string | undefined => {
  if (a.trim() === '' && b.trim() === '') return undefined;

  return `${a.trim() || '0'}:${b.trim() || '0'}`;
};

export const toNum = (value: string): number | undefined => {
  const n = Number(value);

  return value.trim() === '' || Number.isNaN(n) ? undefined : n;
};

// A single-file animation is either an APNG (renders in <img>) or a WebM/VP9-alpha clip (needs
// <video>). Library WebM ends in `.webm`; an uploaded one arrives as a `data:video/...` URL.
export const isAnimationVideo = (url: string): boolean => /\.webm($|\?)/i.test(url) || url.startsWith('data:video');
