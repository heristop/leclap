// The bundled sound-effect library: one manifest the schema (id enum), the mix (duration, anchor,
// default level), the auto placement and the motion catalog all read. The files themselves are
// synthesized by packages/leclap-creative-kit/scripts/gen-sfx.ts into its src/library/sfx/ folder (original,
// license-free audio); a test checks every entry against the file on disk. Pure data.

export const SFX_IDS = [
  'whoosh',
  'swoosh-short',
  'hit',
  'boom',
  'riser',
  'click',
  'tick',
  'pop',
  'shutter',
  'ding',
] as const;

export type SfxId = (typeof SFX_IDS)[number];

export interface SfxEntry {
  id: SfxId;
  /** File name under the library's `sfx/` folder. */
  file: string;
  /** Length in seconds. */
  duration: number;
  /** Which edge of the sound lands on `at`: `start` plays from `at`, `end` finishes at `at` (a riser). */
  anchor: 'start' | 'end';
  /** Level (gain, 0..2) when a cue sets no `volume`; the files are peak-normalised to -3 dBFS. */
  defaultVolume: number;
  useWhen: string;
  avoidWhen: string;
}

function entry(id: SfxId, duration: number, rest: Omit<SfxEntry, 'id' | 'file' | 'duration'>): SfxEntry {
  return { id, file: `${id}.m4a`, duration, ...rest };
}

export const SFX_LIBRARY: Record<SfxId, SfxEntry> = {
  whoosh: entry('whoosh', 0.6, {
    anchor: 'start',
    defaultVolume: 0.5,
    useWhen: 'a designed transition (push, swipe, zoom-through) or a fast camera move',
    avoidWhen: 'calm fades and dissolves, or more than one per two seconds',
  }),
  'swoosh-short': entry('swoosh-short', 0.3, {
    anchor: 'start',
    defaultVolume: 0.45,
    useWhen: 'a quick slide-in of a label, panel or lower third',
    avoidWhen: 'slow reveals; pair a long transition with whoosh instead',
  }),
  hit: entry('hit', 0.5, {
    anchor: 'start',
    defaultVolume: 0.7,
    useWhen: 'a kinetic impact landing, a camera hit or a flash on the beat',
    avoidWhen: 'body copy and calm beats; more than one hit per beat',
  }),
  boom: entry('boom', 1.2, {
    anchor: 'start',
    defaultVolume: 0.7,
    useWhen: 'the drop or the reveal after a riser, a title slam',
    avoidWhen: 'anything but the single biggest moment of the video',
  }),
  riser: entry('riser', 2, {
    anchor: 'end',
    defaultVolume: 0.5,
    useWhen: 'building into a drop or reveal: place it at the moment it leads into ("cue:drop")',
    avoidWhen: 'sections shorter than the riser, or several builds in a row',
  }),
  click: entry('click', 0.05, {
    anchor: 'start',
    defaultVolume: 0.5,
    useWhen: 'a UI tap or button press in a product demo',
    avoidWhen: 'cinematic pieces',
  }),
  tick: entry('tick', 0.06, {
    anchor: 'start',
    defaultVolume: 0.45,
    useWhen: 'a counter step, a typewriter rhythm or a list item appearing',
    avoidWhen: 'dense repetition faster than 6 per second',
  }),
  pop: entry('pop', 0.15, {
    anchor: 'start',
    defaultVolume: 0.55,
    useWhen: 'playful labels, stickers, emoji or a pop kinetic preset',
    avoidWhen: 'serious or corporate tone',
  }),
  shutter: entry('shutter', 0.25, {
    anchor: 'start',
    defaultVolume: 0.6,
    useWhen: 'a freeze frame, a photo reveal or a flash graphic',
    avoidWhen: 'moments with no photographic idea',
  }),
  ding: entry('ding', 1.5, {
    anchor: 'start',
    defaultVolume: 0.45,
    useWhen: 'a success state, a notification or a final call to action',
    avoidWhen: 'more than once per video',
  }),
};

export function sfxEntry(id: string): SfxEntry | undefined {
  return Object.hasOwn(SFX_LIBRARY, id) ? SFX_LIBRARY[id as SfxId] : undefined;
}
