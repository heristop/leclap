// The showcase's single clock. Picture (showcase.tsx), score (audio/generate-score.ts) and voice
// (audio/generate-voice.ts) all read their cue points from here, so a cut, a drum hit and a line of
// narration can never drift apart. Everything is in SECONDS; the composition converts to frames.
//
// The score runs at 120 BPM, so one beat is 0.5s and one bar is 2s. Every scene boundary sits on a bar
// line — that is what makes the cuts feel like they land on the music instead of near it.

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

export const BPM = 120;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;

export type SceneId =
  | 'curtain'
  | 'title'
  | 'template'
  | 'everywhere'
  | 'desktop'
  | 'mobile'
  | 'useCases'
  | 'agentic'
  | 'finale';

export interface SceneSlot {
  id: SceneId;
  from: number;
  to: number;
}

export const SCENES: readonly SceneSlot[] = [
  { id: 'curtain', from: 0, to: 6 },
  { id: 'title', from: 6, to: 10 },
  { id: 'template', from: 10, to: 18 },
  { id: 'everywhere', from: 18, to: 24 },
  { id: 'desktop', from: 24, to: 32 },
  { id: 'mobile', from: 32, to: 48 },
  { id: 'useCases', from: 48, to: 54 },
  { id: 'agentic', from: 54, to: 70 },
  { id: 'finale', from: 70, to: 78 },
];

export const DURATION = 78;

/** The big impacts: a boom, a crash and a white flash land together on each. */
export const HITS = {
  title: 6,
  magic: 32,
  drop: 40,
  proof: 67,
  finale: 70,
} as const;

/** The moments Clappy (the mascot) slams shut. Each one motivates the cut that follows it. */
export const CLAPS = [5.2, 17.6, 69.6] as const;

/**
 * Inside the agentic scene: the evidence video lands in the pull request at `attach` and plays
 * full-frame; `before` / `wipe` / `after` are its sections, read off the engine render
 * (public/captures/pr-evidence.mp4: intro card, BEFORE, a wipe, AFTER). The narrator's "Before…" and
 * "After…" and the squint-o-meter all key off these.
 */
const AGENTIC_WIPE = 63.1;
export const AGENTIC = { attach: 58.6, before: 59.9, wipe: AGENTIC_WIPE, after: 63.7 } as const;

/** Whooshes under the softer cuts. */
export const WHOOSHES = [10, 18, 24, 45.5, 48, 54, AGENTIC_WIPE] as const;

/** Inside the mobile scene: where the on-device render starts, and where the finished video plays. */
export const MOBILE = {
  pick: 32,
  shoot: 35,
  render: 38,
  drop: 40,
  zoomThrough: 45.5,
} as const;

export const sceneById = (id: SceneId): SceneSlot => {
  const slot = SCENES.find((scene) => scene.id === id);

  if (!slot) throw new Error(`Unknown scene ${id}`);

  return slot;
};

export const toFrames = (seconds: number): number => Math.round(seconds * FPS);
