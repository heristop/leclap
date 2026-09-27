// The showcase score, written against the picture: every section boundary, impact, clap and whoosh
// comes from src/showcase/timeline.ts, so the drop lands on the frame the phone finishes rendering.
// The palette is keynote minimal (keynote.ts): marimba, sub, snaps and shaker, airy pads, bells.
//
//   0–6    curtain     the music-box motif over an airy pad, clock ticks, a soft riser into the curtain clap
//   6–10   title       a clean hit, the marimba enters, bells on the downbeats, the pulse starts half-time
//   10–32  groove      half-time (A) then four-on-the-floor with a second marimba answering (B)
//   32–40  the magic   breakdown: ticks, the motif, a filtered marimba; a 4 s riser and a kick build
//   40–48  the drop    everything in, and the melody on marimba and bells — the fullest moment of the film
//   48–54  use cases   a chord hit on every card
//   54–70  agentic     a tighter, digital marimba over offbeat sub; a hit on AFTER and on "Show it!"
//   70–78  finale      the last hit, the motif one more time, the chord rings out
import { AGENTIC, CLAPS, HITS, WHOOSHES } from '../../src/showcase/timeline.ts';
import { BEAT, type Score } from '../synth.ts';
import { keynote } from './keynote.ts';

export const arrangeShowcase = (score: Score): void => {
  const { kick, clap, tick, bell, bass, pad, riser, whoosh, PROGRESSION, grid, motif, clapRoll } = score;
  const { marimba, pulse, sub, air, sparkle, chordHit, melody, hit } = keynote(score);

  // 0–6 · curtain
  pad(0, PROGRESSION[0].voicing, 2.9, 0.045, 900);
  pad(3, PROGRESSION[1].voicing, 2.6, 0.045, 1100);
  motif(0.8, 0.14);
  marimba(2, 6, { gain: 0.035, cutoff: 900 });

  for (const t of grid(0.5, 5, BEAT)) tick(t, 0.08);

  riser(3.2, 2.0, 0.14);

  // Clappy's slams — each one opens a door in the edit.
  for (const t of CLAPS) {
    clap(t, 0.9);
    clap(t + 0.004, 0.5, 0.4);
  }

  // 6–10 · title
  hit(HITS.title, 1);
  air(6, 10, 0.04, 2400);
  sub(6, 10, 'held');
  marimba(6, 10);
  sparkle(6, 10);
  pulse(8, 10, 'half');
  riser(9, 1, 0.1);

  // 10–32 · groove
  pulse(10, 18, 'half');
  pulse(18, 30, 'four');
  pulse(30, 31.5, 'four', 0.8);
  marimba(10, 32);
  marimba(18, 30, { octave: 12, gain: 0.035, offset: BEAT / 2 });
  sub(10, 18, 'halves');
  sub(18, 32, 'halves');
  air(10, 32, 0.028, 1900);
  sparkle(18, 30, 0.06);
  riser(30, 2, 0.18);
  clapRoll(31, 32, 0.2);

  // 32–40 · the magic (breakdown → build)
  hit(HITS.magic, 0.8);
  air(32, 40, 0.035, 900);
  sub(32, 38, 'held', 0.22);
  marimba(32, 38, { gain: 0.045, cutoff: 700 });

  for (const t of grid(32, 38, BEAT)) tick(t, 0.08);

  motif(33.2, 0.14);
  riser(36, 3.85, 0.22);

  for (const t of grid(38, 39.85, BEAT / 2)) kick(t, 0.6);

  clapRoll(38, 39.85, 0.24);

  // 40–48 · the drop
  hit(HITS.drop, 1.2);
  pulse(40.5, 47.5, 'four');
  marimba(40, 48);
  marimba(40, 48, { octave: 12, gain: 0.04, offset: BEAT / 2 });
  sub(40, 47.5, 'eighths', 0.3);
  air(40, 48, 0.035, 2600);
  melody([
    [40.0, 76, 0.45],
    [40.5, 74, 0.45],
    [41.0, 72, 0.45],
    [41.5, 74, 0.45],
    [42.0, 72, 0.9],
    [43.0, 69, 0.9],
    [44.0, 76, 0.45],
    [44.5, 79, 0.45],
    [45.0, 76, 0.45],
    [45.5, 74, 0.45],
    [46.0, 72, 1.4],
    [47.5, 71, 0.45],
  ]);
  riser(47, 1, 0.12);

  // 48–54 · use cases
  pulse(48, 53.5, 'four', 0.9);
  marimba(48, 54, { gain: 0.06 });
  sub(48, 53.5, 'halves');
  air(48, 54, 0.03, 2200);

  for (const t of [48, 49.5, 51, 52.5]) chordHit(t, 0.09);

  riser(53, 1, 0.1);

  // 54–70 · agentic
  kick(54, 0.9);
  pulse(54.5, 67.5, 'four', 0.85);
  marimba(54, 67.5, { gain: 0.055, cutoff: 1800, square: true });
  sub(54.5, 67.5, 'eighths', 0.26);
  air(54, 70, 0.026, 1400);
  chordHit(AGENTIC.after, 0.09);
  hit(HITS.proof, 0.7);
  riser(67.5, 2.35, 0.2);
  clapRoll(68.5, 69.85, 0.22);

  // 70–78 · finale
  hit(HITS.finale, 1.1);
  pad(70, PROGRESSION[0].voicing, 7, 0.06, 2400);
  pad(70, [45, 52], 7, 0.04, 900);
  bass(70, 45, 6.5, 0.26, 0.5);
  motif(71.4, 0.15);
  marimba(70, 75, { gain: 0.05, cutoff: 1200 });
  bell(75.2, 69, 0.13);
  bell(75.2, 76, 0.09, 0.3);

  for (const t of WHOOSHES) whoosh(t, 0.22);
};
