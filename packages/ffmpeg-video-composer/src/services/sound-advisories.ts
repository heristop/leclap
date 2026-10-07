// Sound advisories, read render-free like the pacing lint (never `errors`):
//   sound_preset_unvaried  a `sound.preset` with pitch/length/brightness/room plays the library file as is:
//                          the variations need the presets re-expressed as synth recipes, not yet shipped.
import type { MotionWarning } from './motion-lint';

type Bag = Record<string, unknown>;

const VARIATIONS = ['pitch', 'length', 'brightness', 'room'] as const;

function cues(list: unknown, path: string): Array<{ cue: Bag; path: string }> {
  return Array.isArray(list) ? list.map((cue, k) => ({ cue: (cue ?? {}) as Bag, path: `${path}[${k}]` })) : [];
}

function unvaried({ cue, path }: { cue: Bag; path: string }): MotionWarning[] {
  const sound = cue.sound as Bag | undefined;

  if (typeof sound?.preset !== 'string') return [];

  const varied = VARIATIONS.filter((key) => sound[key] !== undefined);

  if (varied.length === 0) return [];

  return [
    {
      path: `${path}.sound`,
      code: 'sound_preset_unvaried',
      message: `preset "${sound.preset}" plays unvaried: ${varied.join(', ')} not applied yet`,
      severity: 'info',
      hint: 'Compose the sound with layers to shape it now, or keep the preset as is.',
    },
  ];
}

export function soundAdvisories(descriptor: unknown): MotionWarning[] {
  const template = (descriptor ?? {}) as Bag;
  const sections = Array.isArray(template.sections) ? (template.sections as Bag[]) : [];
  const all = [
    ...sections.flatMap((section, i) => cues(section.sfx, `sections[${i}].sfx`)),
    ...cues((template.global as Bag | undefined)?.sfx, 'global.sfx'),
  ];

  return all.flatMap(unvaried);
}
