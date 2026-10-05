// The creative kit's library animations (APNG overlays under `animations/`) are SAMPLES: demo assets that
// show what an overlay input can do. They look the same in every template that uses them, so an author
// composes motion with the engine instead (kinetic type, animate tracks, camera, designed transitions,
// graphics and `type: "fx"` primitives tuned to the brief) and treats a sample as a last resort. This
// table tells the catalog, the catalog search and the sameness lint what each sample is and which engine
// primitives produce that idea as the template's own move. Pure data.

export interface LibrarySample {
  /** File stem under animations/ (e.g. "shine_sweep" for animations/shine_sweep.apng). */
  name: string;
  /** What the stock overlay shows. */
  looksLike: string;
  /** The motion-engine primitives that compose the same idea, tuned to the template. */
  composeWith: string;
}

export const LIBRARY_SAMPLE_NOTE =
  'Sample assets, not building blocks: every template that drops one in looks the same. Compose the idea with ' +
  'the motion engine (composeWith) tuned to the creative direction; use a sample only as a last resort.';

export const LIBRARY_ANIMATION_SAMPLES: LibrarySample[] = [
  {
    name: 'shine_sweep',
    looksLike: 'a full-frame light band sweeping across',
    composeWith:
      'graphics { type: "fx", effect: "sheen", target: the card / title it lights } with its profile, width, tilt, ' +
      'direction, colour ("$color.accent") and ease tuned',
  },
  {
    name: 'sparkle',
    looksLike: 'twinkling star glints',
    composeWith: 'a twin-profile fx sheen with repeat + every on the hero, or a kinetic accent on one word',
  },
  {
    name: 'spec_orbit',
    looksLike: 'a specular glint orbiting a product',
    composeWith: 'a crisp fx sheen (width 0.05–0.1) landing as the product settles, with a camera orbit',
  },
  {
    name: 'light_leak',
    looksLike: 'a warm film light leak over the frame',
    composeWith: 'a warm `look` or grade.colorBalance plus a slow camera drift; a soft, wide fx sheen on the frame',
  },
  {
    name: 'confetti',
    looksLike: 'falling confetti',
    composeWith: 'kinetic pop / drop by glyph with an accent word, a camera hit and one flash on the payoff beat',
  },
  {
    name: 'corner_brackets',
    looksLike: 'viewfinder brackets',
    composeWith: 'graphics { type: "corners" } with inset, length, thickness and a theme colour',
  },
  {
    name: 'glow_border',
    looksLike: 'a glowing frame border',
    composeWith: 'graphics { type: "frame" } tracing on, coloured "$color.accent", plus an fx sheen on its target',
  },
  {
    name: 'white_border',
    looksLike: 'a white frame border',
    composeWith: 'graphics { type: "frame" } with inset and thickness in a theme colour',
  },
  {
    name: 'rounded_border',
    looksLike: 'a rounded frame border',
    composeWith: 'a color_background layer card with a radius, or graphics { type: "frame" }',
  },
  {
    name: 'pulse_ring',
    looksLike: 'an expanding pulse ring',
    composeWith: 'camera hits on the beat, a kinetic pop accent, or a section `pulse` motion at low intensity',
  },
  {
    name: 'tap_pulse',
    looksLike: 'a tap indicator pulse',
    composeWith: 'a kinetic pop on the label being tapped with an animate track (scale / opacity) and a click sfx',
  },
  {
    name: 'animation_icons',
    looksLike: 'stock animated icons',
    composeWith: 'kinetic type and graphics drawn in the theme; a still image input for a real brand icon',
  },
];

const SAMPLE_URL = /(?:^|\/)animations\/([\w-]+)\.(?:apng|webp|gif|webm)$/i;

/** The library sample a url points at (`/assets/animations/x.apng`, `animations/x.apng`…), or null. */
export function librarySampleOf(url: unknown): { name: string; sample?: LibrarySample } | null {
  if (typeof url !== 'string') return null;

  const name = SAMPLE_URL.exec(url.trim())?.[1];

  if (name === undefined) return null;

  return { name, sample: LIBRARY_ANIMATION_SAMPLES.find((entry) => entry.name === name) };
}
