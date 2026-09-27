// The agentic film's single clock (seconds). Picture (agentic-film.tsx), score (audio/scores/agentic.ts)
// and voice (voice-lines.ts) read their cues from here. 120 BPM: a beat is 0.5 s, a bar 2 s, and every
// scene boundary sits on a bar line.
//
// The film follows the four steps of the agentic workflow on leclap.dev (#agentic) — implement, collect
// evidence, render, attach — on the Kiln & Co. demo shop from examples/agentic-pr-video.

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const DURATION = 50;

export type SceneId = 'hook' | 'title' | 'loop' | 'review' | 'outro';

export const SCENES: readonly { id: SceneId; from: number; to: number }[] = [
  { id: 'hook', from: 0, to: 6 },
  { id: 'title', from: 6, to: 10 },
  { id: 'loop', from: 10, to: 32 },
  { id: 'review', from: 32, to: 43 },
  { id: 'outro', from: 43, to: 50 },
];

export const HITS = { title: 6, review: 32, outro: 43, logo: 46.6 } as const;

/** Clappy slams shut at the end of the hook — that clap is the cut to the title. */
export const CLAP = 5.8;

/** The loop's four steps (the camera pans along them; their labels are in copy.ts) and the moments each one completes. */
export const STEPS = [
  { id: 'implement', from: 10, to: 14 },
  { id: 'collect', from: 14, to: 20 },
  { id: 'render', from: 20, to: 28 },
  { id: 'attach', from: 28, to: 32 },
] as const;

export const LOOP = { testsPass: 13.2, valid: 22.6, composeFrom: 23.5, composed: 27.4, attached: 29.2 } as const;

/**
 * The review: the evidence (public/captures/pr-evidence.mp4, or its French render — same sections) starts
 * playing at `play` from 0.9 s into the render (its title card, fully revealed — the poster shown in the
 * PR), so its sections land at:
 */
export const EVIDENCE_POSTER = 0.9;
export const REVIEW = { play: 32.4, before: 32.83, wipe: 36.03, after: 36.63, focus: 39.93, end: 42.33 } as const;

export const WHOOSHES = [10, 14, 20, 28, REVIEW.wipe] as const;

export const sceneById = (id: SceneId): { id: SceneId; from: number; to: number } => {
  const slot = SCENES.find((scene) => scene.id === id);

  if (!slot) throw new Error(`Unknown scene ${id}`);

  return slot;
};

export const toFrames = (seconds: number): number => Math.round(seconds * FPS);
