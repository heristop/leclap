// Recorded-footage descriptor types: look strength, silence trimming, explicit keep ranges, B-roll
// cutaways and the probed source traits. Split out of `types.d.ts` for its max-lines budget and
// re-exported from there; self-contained (primitives only) so the module graph stays acyclic.

/** A look preset by name, or `{ preset, strength }` to blend a LUT look toward the untouched footage. */
export type LookInput = string | { preset: string; strength?: number };

/** Silence trimming for a recorded clip: cut leading/trailing silence and long pauses (Node analysis). */
export interface TrimSilence {
  /** Trim leading/trailing silence (default true). */
  edges?: boolean;
  /** Also cut pauses inside the take; `{}` enables it with the defaults. */
  gaps?: { minSilence?: number; margin?: number; threshold?: number };
}

/** One kept window `[from, to]` of the source clip, in source seconds. */
export type KeepRange = [number, number];

export interface Cutaway {
  url: string;
  /** Section time (seconds or a time reference) the cutaway starts at. */
  at: number | string;
  duration: number;
  /** Source time of the cutaway clip to start from (default 0). */
  from?: number;
  /** a = keep the main audio (default), b = the cutaway's audio, mix = both. */
  audio?: 'a' | 'b' | 'mix';
  fit?: 'cover' | 'contain';
}

/** Colour/timing traits read off a probed video stream (core/footage/media-traits.ts). */
export interface MediaTraits {
  hdr: 'pq' | 'hlg' | 'dolby-vision' | null;
  colorPrimaries: string | null;
  colorTransfer: string | null;
  bitDepth: number | null;
  vfr: boolean;
  /** Display rotation FFmpeg's autorotation applies, normalised to 0/90/180/270. */
  rotation: number;
}
