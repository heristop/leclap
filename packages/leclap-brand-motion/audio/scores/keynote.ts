// The films' palette, "keynote minimal": marimba-like plucks on a syncopated ostinato, a sub bass on the
// roots, snaps and a shaker over a clean kick, airy pads, bells for sparkle — space around the voice rather
// than a wall of synths. Built on the films' synth and grid (A minor, 120 BPM, Am – F – C – G, a chord a bar),
// so an arrangement keeps every cue where the picture put it and only chooses the colours.
import { BAR, BEAT, type Score } from '../synth.ts';

const SIXTEENTH = BEAT / 4;

// Per chord of the progression, in its bar order: the marimba's upper-structure tones (Am7, F, C/G, G) and
// the sub bass root.
const TONES: readonly (readonly number[])[] = [
  [69, 72, 76, 79],
  [65, 69, 72, 77],
  [67, 72, 76, 79],
  [67, 71, 74, 79],
];
const ROOTS: readonly number[] = [45, 41, 48, 43];

/** The ostinato's 16th steps in a bar: syncopated, so it grooves without the kick. */
const PATTERN: readonly number[] = [0, 3, 6, 8, 11, 14];

export const keynote = (score: Score) => {
  const { kick, boom, crash, clap, hat, bass, pluck, pad, bell, grid, bars } = score;
  const chord = (t: number): number => Math.floor(t / BAR + 1e-6) % TONES.length;
  const tonesAt = (t: number): readonly number[] => TONES[chord(t)];
  const rootAt = (t: number): number => ROOTS[chord(t)];

  /** The marimba ostinato; `square` gives the agentic sections a more digital tone. */
  const marimba = (
    from: number,
    to: number,
    { octave = 0, gain = 0.07, cutoff = 1500, square = false, offset = 0 } = {}
  ): void => {
    for (const bar of bars(from, to)) {
      for (const [index, step] of PATTERN.entries()) {
        const at = bar + offset + step * SIXTEENTH;

        if (at >= to) continue;

        const tones = tonesAt(bar);
        pluck(at, tones[index % tones.length] + octave, { gain, cutoff, pan: index % 2 === 0 ? -0.3 : 0.3, square });
      }
    }
  };

  /** The beat: kick on 1 and 3 ('half') or every beat ('four'), snaps on 2 and 4, a 16th shaker. */
  const pulse = (from: number, to: number, feel: 'half' | 'four', level = 1): void => {
    for (const t of grid(from, to, BEAT)) {
      const beat = Math.round(t / BEAT) % 4;

      if (feel === 'four' || beat % 2 === 0) kick(t, (feel === 'four' ? 0.7 : 0.55) * level);

      if (beat % 2 === 1) clap(t, 0.22 * level, 0.1);

      for (const q of [0, 0.25, 0.5, 0.75]) hat(t + BEAT * q, (q === 0.5 ? 0.07 : 0.035) * level, false, 0.35);
    }
  };

  /** Sub bass on the roots: one note a bar, two, or eighths. */
  const sub = (from: number, to: number, pattern: 'held' | 'halves' | 'eighths', gain = 0.26): void => {
    for (const bar of bars(from, to)) {
      const root = rootAt(bar);

      if (pattern === 'held') {
        bass(bar, root, BAR - 0.1, gain, 0.4);
        continue;
      }

      const step = pattern === 'halves' ? BAR / 2 : BEAT / 2;
      const level = pattern === 'halves' ? gain : gain * 0.85;

      for (const t of grid(bar, Math.min(bar + BAR, to), step)) {
        bass(t, root, step - 0.05, level, 0.5);
      }
    }
  };

  /** Airy pads on the marimba's chords. */
  const air = (from: number, to: number, gain = 0.035, cutoff = 2400): void => {
    for (const bar of bars(from, to)) pad(bar, tonesAt(bar), Math.min(BAR, to - bar) - 0.05, gain, cutoff);
  };

  /** A bell on each downbeat, the chord's top note an octave up. */
  const sparkle = (from: number, to: number, gain = 0.07): void => {
    for (const bar of bars(from, to)) bell(bar, tonesAt(bar)[3] + 12, gain, 0.4);
  };

  /** A plucked chord with a bell on top: the accent on a card, a step, an AFTER. */
  const chordHit = (at: number, gain = 0.08): void => {
    const tones = tonesAt(at);

    for (const [index, note] of tones.entries()) pluck(at, note, { gain, cutoff: 2600, pan: (index - 1.5) * 0.3 });
    bell(at, tones[3] + 12, gain * 0.9, 0.2);
  };

  /** A melody on the marimba, doubled an octave up on bells. */
  const melody = (notes: readonly (readonly [number, number, number])[], gain = 0.09): void => {
    for (const [at, note] of notes) {
      pluck(at, note, { gain, cutoff: 2800, pan: 0 });
      bell(at, note + 12, gain * 0.55, 0.15);
    }
  };

  /** The keynote's impact: a clean boom, a light crash, one kick — weight without the future-bass slam. */
  const hit = (at: number, strength = 1): void => {
    boom(at, 0.8 * strength);
    crash(at, 0.12 * strength, 2.4);
    kick(at, 0.9 * strength);
  };

  return { marimba, pulse, sub, air, sparkle, chordHit, melody, hit };
};
