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
import { platformCatalog, type PlatformCatalogEntry } from '../platforms';
import { themeCatalog, type ThemeCatalog } from '../theme/catalog';
import { CAMERA_GUIDES, GRAPHIC_GUIDES, KINETIC_GUIDES, TRANSITION_GUIDES, type MotionGuide } from './catalog-guides';
import { GENRE_DOCTRINE, type GenreDoctrine, type MotionGenre } from './catalog-doctrine';
import { MOTION_BLUEPRINTS, type MotionBlueprint } from './catalog-blueprints';
import { FORMATS_ART_DIRECTION, FORMATS_GUIDE } from '../formats/guide';

export type { MotionGuide } from './catalog-guides';
export type { GenreDoctrine, MotionGenre } from './catalog-doctrine';
export type { BlueprintRole, MotionBlueprint } from './catalog-blueprints';
import { TIME_REF_SYNTAX } from '../timing/grammar';

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
  'Set global.platform (tiktok, reels, shorts, youtube, x, linkedin, facebook, square-feed) when the video ' +
    'has a destination: keep kinetic copy and graphics out of its safe zones (see platforms[].safe, fractions ' +
    'of the frame per edge) and the timeline under platforms[].maxDuration.',
  FORMATS_ART_DIRECTION,
  'Every result is deterministic: the same JSON and global.seed render the same frames. Change the seed to ' +
    'reshuffle random order, scramble glyphs and grain.',
  'Pick a genre doctrine first, then a blueprint per narrative role; keep each blueprint signatureMove. Every ' +
    'element needs a verb (see each entry); two elements with the same verb in one beat compete.',
  'Pacing: one primary transition plus 1–2 accents; the transition is the exit (no element exit right before it); ' +
    'start text 0.1–0.3 s after the cut; vary eases by role; the slowest beat runs ≥ 3× the fastest.',
  'Prove the choreography with section `assert` (visibleBy, before, inFrame, keepsMoving) and read the advisory ' +
    'motionWarnings from validate_template before rendering.',
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
        {
          id: 'headline',
          text: { en: 'Make every word land.' },
          preset: 'cascade',
          accent: { words: 'last' },
          exit: 'cascade',
        },
        {
          text: { en: 'Physics, not keyframes' },
          preset: 'highlight',
          font: 'oswald',
          size: 46,
          y: 'bottom',
          delay: 'headline.end + 0.1',
        },
      ],
    },
  ],
};

type Guided<T> = T & MotionGuide;

export interface MotionCatalog {
  rules: string[];
  doctrine: Record<MotionGenre, GenreDoctrine>;
  blueprints: MotionBlueprint[];
  kinetic: {
    presets: Array<Guided<ReturnType<typeof kineticCatalog>[number]>>;
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
  camera: { presets: Array<Guided<{ preset: string }>>; fields: string[] };
  transitions: Record<string, Guided<{ description: string }>>;
  graphics: Record<string, Guided<{ description: string }>>;
  tokens: typeof BUILTIN_MOTION_TOKENS;
  /** Delivery platforms for `global.platform`: orientation, safe zones, max duration, loudness. */
  platforms: PlatformCatalogEntry[];
  /** Built-in themes (palette, fonts, motion feel) and the `$color.*` / `$font.*` grammar. */
  themes: ThemeCatalog;
  timing: typeof TIMING;
  starter: typeof STARTER;
  /** One story, several formats: `formats` overrides, `$format` values, merge rules (core/formats). */
  formats: typeof FORMATS_GUIDE;
}

// Time references: name the moment instead of computing it. Resolved to seconds at compile time.
const TIMING = {
  fields: [
    'kinetic[].delay',
    'kinetic[].exit.at',
    'graphics[].at',
    'graphics[].until',
    'camera.delay',
    'camera.hits[] / hits[].at',
    'camera.zoom|x|y|rotate[].t',
    'filters[].reveal.delay (drawtext)',
    'filters[].exit.after (drawtext)',
    'filters[].animate.*[].t',
  ],
  grammar: TIME_REF_SYNTAX,
  bases: {
    '<id>.start': 'When the element with that id (kinetic block, graphic, drawtext filter) in this section starts.',
    '<id>.end':
      'When its entrance has landed: kinetic = last unit arrived; graphic = at + duration; drawtext = reveal delay + duration.',
    '<n>%': 'A fraction of the section duration (needs a known duration).',
    end: 'The section end.',
    'beat:<n>': 'The n-th beat of global.beats (1-based, counted on the whole video), as section time.',
    'bar:<n>': 'The downbeat of bar n of global.beats.',
    'cue:<name>': 'A named point in this section, from sections[].cues.',
  },
  examples: [
    '"title.end + 0.2"',
    '"title.start - 0.1"',
    '"50%"',
    '"end - 0.5"',
    '"beat:12"',
    '"bar:3 - 0.1"',
    '"cue:drop - 0.1"',
  ],
  rules: [
    'Give an element an id only when something references it; ids are unique within a section.',
    'Hits (camera hits, flash graphics) land exactly on the beat: "beat:12".',
    'Entrances read as on the beat when they lead it by 0.04–0.19 s: "beat:12 - 0.1".',
    'Chain beats with references ("headline.end + 0.15") rather than adding seconds by hand.',
    'beat/bar need global.beats ({ bpm, offset?, beatsPerBar? } or { times }) and every earlier section to declare options.duration.',
  ],
  errors: ['unknown_time_ref', 'circular_time_ref', 'unresolvable_time_ref', 'negative_time', 'duplicate_time_id'],
};

const BASIC_TRANSITIONS: Record<string, string> = {
  cut: 'A hard cut: free to render, lands on the beat.',
  fade: 'A crossfade between the two scenes.',
  fadeblack: 'Dips through black: a chapter break.',
  dissolve: 'A grainy, organic dissolve.',
};

const GRAPHICS: Record<string, string> = {
  flash: 'Full-frame light hit that decays (at, duration, color, intensity).',
  bars: 'Cinema letterbox bars slide in (aspect).',
  underline: 'A rule that draws itself (x, y, width, thickness, origin).',
  frame: 'A rectangle outline tracing itself clockwise (inset, thickness).',
  corners: 'Viewfinder brackets extending from the corners (inset, length, thickness).',
  wipe: 'A colour panel sweeping across the frame: covers then uncovers (direction).',
  panel: 'A solid block growing from one edge: a backing plate for text (x, y, width, height, from).',
};

function guided(descriptions: Record<string, string>, guides: Record<string, MotionGuide>) {
  return Object.fromEntries(
    Object.entries(descriptions).map(([name, description]) => [name, { description, ...guides[name] }])
  );
}

export function motionCatalog(): MotionCatalog {
  return {
    rules: ART_DIRECTION,
    doctrine: GENRE_DOCTRINE,
    blueprints: MOTION_BLUEPRINTS,
    kinetic: {
      presets: kineticCatalog().map((entry) => ({ ...entry, ...KINETIC_GUIDES[entry.preset] })),
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
      presets: CAMERA_PRESETS.map((preset) => ({ preset, ...CAMERA_GUIDES[preset] })),
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
    transitions: guided({ ...BASIC_TRANSITIONS, ...DESIGNED_TRANSITION_DESCRIPTIONS }, TRANSITION_GUIDES),
    graphics: guided(GRAPHICS, GRAPHIC_GUIDES),
    tokens: BUILTIN_MOTION_TOKENS,
    platforms: platformCatalog(),
    themes: themeCatalog(),
    timing: TIMING,
    starter: STARTER,
    formats: FORMATS_GUIDE,
  };
}
