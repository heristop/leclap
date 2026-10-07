// What one `sfx` cue plays: a library id (its bundled file), a preset `sound` (for now the preset's bundled
// file: its pitch/length/brightness/room variations apply once the presets are re-expressed as synth
// recipes; the validator warns until then), or a composed `sound`, named by the hash of its content and,
// when it draws random numbers, its seed, so identical sounds share one rendered file. Pure.

import type { SfxCue } from '../../schemas/audio.schemas';
import type { SoundInput } from '../../schemas/sound.schemas';
import { canonicalJson } from '../determinism/hash';
import { sha256Hex } from '../determinism/sha256';
import { sfxEntry, type SfxEntry } from './sfx-library';
import { DEFAULT_SOUND_VOLUME, SYNTH_VERSION } from './synth/bounds';
import { soundUsesSeed } from './synth/render';
import { soundLength } from './synth/timing';
import type { ComposedSound, Layer } from './synth/types';

export interface ComposedPlacement {
  spec: ComposedSound;
  /** The seed the render uses (0 when the sound draws no random numbers). */
  seed: number;
}

export interface ResolvedCue extends Pick<SfxEntry, 'duration' | 'anchor' | 'defaultVolume'> {
  id: string;
  /** A library file name, or `<hash>.wav` for a composed sound. */
  file: string;
  sound?: ComposedPlacement;
}

/** The synth's view of a composed sound (the schema's `anchor` only matters to the mix). */
export function composedSpec(sound: SoundInput): ComposedSound {
  const { length, fx } = sound;
  // The schema keeps one flat layer object (small in the prompt); its refinement enforces the per-source
  // fields the synth's union types spell out.
  const layers = (sound.layers ?? []) as Layer[];

  return { layers, ...(length === undefined ? {} : { length }), ...(fx ? { fx } : {}) };
}

/** The build file of a composed sound rendered with `seed`. */
export function soundFileName(spec: ComposedSound, seed: number): string {
  return `${sha256Hex(canonicalJson({ v: SYNTH_VERSION, spec, seed })).slice(0, 16)}.wav`;
}

function library(entry: SfxEntry | undefined): ResolvedCue | undefined {
  if (!entry) return undefined;

  const { id, file, duration, anchor, defaultVolume } = entry;

  return { id, file, duration, anchor, defaultVolume };
}

function composed(sound: SoundInput, cueSeed: number): ResolvedCue {
  const spec = composedSpec(sound);
  const seed = soundUsesSeed(spec) ? cueSeed >>> 0 : 0;
  const file = soundFileName(spec, seed);

  return {
    id: `sound-${file.slice(0, 8)}`,
    file,
    duration: soundLength(spec),
    anchor: sound.anchor ?? 'start',
    defaultVolume: DEFAULT_SOUND_VOLUME,
    sound: { spec, seed },
  };
}

/** The sound a cue plays, with `cueSeed` = deriveSeed(global.seed, the cue's path); undefined if unknown. */
export function resolveCue(cue: SfxCue, cueSeed: number): ResolvedCue | undefined {
  if (cue.id !== undefined) return library(sfxEntry(cue.id));

  if (!cue.sound) return undefined;

  if (cue.sound.preset !== undefined) {
    const preset = library(sfxEntry(cue.sound.preset));

    return preset && { ...preset, anchor: cue.sound.anchor ?? preset.anchor };
  }

  return composed(cue.sound, cueSeed);
}
