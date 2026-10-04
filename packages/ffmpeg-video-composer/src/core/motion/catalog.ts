// The motion catalog: everything an agent needs to choose and configure motion without reading
// source. One data structure serves MCP (`get_motion_catalog`), the CLI and the template builder's
// prompt-to-template flow, so they always agree with the engine.

import { CSS_BEZIERS, NAMED_CURVES } from './curves';
import { LEGACY_EASINGS, MIN_DAMPING_RATIO } from './easing';
import { BUILTIN_MOTION_TOKENS } from './tokens';
import { kineticCatalog } from '../kinetic/presets';
import { KINETIC_EXIT_PRESETS, KINETIC_ORDERS } from '../../schemas/kinetic.schemas';
import { CAMERA_PRESETS } from '../../schemas/camera.schemas';
import { DESIGNED_TRANSITION_DESCRIPTIONS } from './transitions';

const ART_DIRECTION = [
  'One idea per beat: one dominant kinetic block, at most one supporting block. Hold every beat at least ' +
    '0.4 s + words / 3.5 s after the last unit lands.',
  'Pick a preset for the job: cascade/rise for headlines, impact for a single punch word, pop for playful ' +
    'labels, tracking-in for a brand title, typewriter/scramble for tech or reveal moments, highlight to ' +
    'point at one word, counter for a stat, split for a closing statement, fade for calm instructions.',
  'Physics over timing: prefer spring eases ($snappy, $bouncy, $gentle) and omit duration so the spring ' +
    'decides. Use $expo or $smooth when a move must feel controlled rather than physical.',
  'Use global.motion.energy as the single intensity dial (0 reduced motion, 1 default, 1.5 hype) instead ' +
    'of editing every distance.',
  'Accent one word per line at most (accent.words), in a brand colour. Vary presets between beats; the same ' +
    'preset three beats in a row reads as a template, not direction.',
  'Exits: none for a hard cut on the beat, fade for calm, cascade for energy. A block holds to the cut by default.',
  'Word/glyph units need a bundled font (bebas, oswald, anton, archivo-black, bungee, mono, rubik, playfair, ' +
    'righteous, abril-fatface, lobster, pacifico). At most 64 units per block; longer copy steps up to words/lines.',
  'Camera: one move per beat (push-in for build-up, drift for calm, orbit for product, handheld for documentary); ' +
    'add hits on the beats where impact type lands, optionally with a flash graphic at the same time.',
  'Graphics: corners or frame for focus, underline under a headline, panel as a backing plate, bars for cinema, ' +
    'wipe as an in-scene page turn, flash for impact (at most 3 per second).',
  'Transitions: push for sequence, swipe for layering, zoom-through for energy, iris for reveals; keep 0.5–0.8 s and ' +
    'prefer cut between beats of the same idea. Designed transitions ease like any other motion (ease: $snappy…).',
  'Every result is deterministic: the same JSON and global.seed render the same frames. Change the seed to ' +
    'reshuffle random order, scramble glyphs and grain.',
];

const STARTER = {
  meta: { name: 'Kinetic starter' },
  global: { orientation: 'landscape', fps: 30, musicEnabled: false, seed: 1, motion: { energy: 1 } },
  sections: [
    {
      name: 'hook',
      type: 'color_background',
      options: { backgroundColor: '#141416', duration: 3 },
      camera: { preset: 'push-in', amount: 0.08, hits: [0.6] },
      graphics: [{ type: 'flash', at: 0.6, duration: 0.25 }],
      kinetic: [
        { text: { en: 'Make every word land.' }, preset: 'cascade', accent: { words: 'last' }, exit: 'cascade' },
        {
          text: { en: 'Physics, not keyframes' },
          preset: 'highlight',
          font: 'oswald',
          size: 46,
          y: 'bottom',
          delay: 0.7,
        },
      ],
    },
  ],
};

export interface MotionCatalog {
  rules: string[];
  kinetic: {
    presets: ReturnType<typeof kineticCatalog>;
    exits: readonly string[];
    orders: readonly string[];
    units: readonly string[];
  };
  easing: {
    historical: readonly string[];
    named: string[];
    functions: string[];
    springRules: string;
  };
  camera: { presets: readonly string[]; fields: string[] };
  transitions: Record<string, string>;
  graphics: Record<string, string>;
  tokens: typeof BUILTIN_MOTION_TOKENS;
  starter: typeof STARTER;
}

const GRAPHICS: Record<string, string> = {
  flash: 'Full-frame light hit that decays (at, duration, color, intensity).',
  bars: 'Cinema letterbox bars slide in (aspect).',
  underline: 'A rule that draws itself (x, y, width, thickness, origin).',
  frame: 'A rectangle outline tracing itself clockwise (inset, thickness).',
  corners: 'Viewfinder brackets extending from the corners (inset, length, thickness).',
  wipe: 'A colour panel sweeping across the frame: covers then uncovers (direction).',
  panel: 'A solid block growing from one edge: a backing plate for text (x, y, width, height, from).',
};

export function motionCatalog(): MotionCatalog {
  return {
    rules: ART_DIRECTION,
    kinetic: {
      presets: kineticCatalog(),
      exits: KINETIC_EXIT_PRESETS,
      orders: KINETIC_ORDERS,
      units: ['line', 'word', 'glyph'],
    },
    easing: {
      historical: LEGACY_EASINGS,
      named: [...Object.keys(CSS_BEZIERS), ...Object.keys(NAMED_CURVES)],
      functions: [
        'cubic-bezier(x1, y1, x2, y2)',
        'spring(stiffness, damping[, mass[, velocity]])',
        'steps(count[, start|end])',
        '{ "points": [[0,0],[0.4,1.08],[1,1]] }',
        '$token',
      ],
      springRules: `stiffness 1..2000, damping 1..200, mass 0.1..20, velocity -50..50, damping ratio ≥ ${MIN_DAMPING_RATIO}; with no duration a spring takes its own settle time.`,
    },
    camera: {
      presets: CAMERA_PRESETS,
      fields: [
        'preset',
        'amount',
        'delay',
        'duration',
        'ease',
        'zoom[]',
        'x[]',
        'y[]',
        'rotate[]',
        'hits[]',
        'shake',
        'includeText',
      ],
    },
    transitions: DESIGNED_TRANSITION_DESCRIPTIONS,
    graphics: GRAPHICS,
    tokens: BUILTIN_MOTION_TOKENS,
    starter: STARTER,
  };
}
