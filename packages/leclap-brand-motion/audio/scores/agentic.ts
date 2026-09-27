// The agentic film's score, written against src/agentic/timeline.ts, in the keynote minimal palette
// (keynote.ts).
//
//   0–6    hook     an airy pad, the clock ticking, a light heartbeat — the reviewer squinting; riser into the clap
//   6–10   title    a clean hit, the marimba enters, bells on the downbeats, the pulse starts half-time
//   10–32  loop     a focused groove on a digital marimba and offbeat sub — a chord hit on every step,
//                   a small bell on every ✓ (tests pass, template valid, video composed, attached)
//   32–43  review   four-on-the-floor, the marimba doubles, and the melody enters with AFTER
//   43–50  outro    the last hit, the music-box motif, the chord rings out under the logo
import { CLAP, HITS, LOOP, REVIEW, STEPS, WHOOSHES } from '../../src/agentic/timeline.ts';
import { BEAT, type Score } from '../synth.ts';
import { keynote } from './keynote.ts';

export const arrangeAgentic = (score: Score): void => {
  const { kick, boom, crash, clap, tick, heartbeat, bell, bass, pad, riser, whoosh } = score;
  const { PROGRESSION, grid, motif, clapRoll } = score;
  const { marimba, pulse, sub, air, sparkle, chordHit, melody, hit } = keynote(score);

  // 0–6 · hook
  pad(0, PROGRESSION[0].voicing, 2.9, 0.045, 900);
  pad(3, PROGRESSION[1].voicing, 2.8, 0.045, 1100);
  bass(0, 45, 5.8, 0.16, 0.4);

  for (const t of grid(0.5, 5.5, BEAT)) tick(t, 0.09);

  for (const t of [1, 3, 5]) heartbeat(t, 0.28);

  riser(4, 1.8, 0.15);
  clap(CLAP, 0.9);
  clap(CLAP + 0.004, 0.5, 0.4);

  // 6–10 · title
  hit(HITS.title, 1);
  air(6, 10, 0.04, 2400);
  sub(6, 10, 'held');
  marimba(6, 10);
  sparkle(6, 10);
  pulse(8, 10, 'half');
  riser(9, 1, 0.1);

  // 10–32 · the loop
  kick(10, 0.9);
  pulse(10.5, 20, 'half');
  pulse(20, 31.5, 'four', 0.85);
  marimba(10, 32, { gain: 0.06, cutoff: 1800, square: true });
  sub(10.5, 31.5, 'eighths', 0.24);
  air(10, 32, 0.026, 1500);

  for (const step of STEPS.slice(1)) chordHit(step.from, 0.08);

  for (const done of [LOOP.testsPass, LOOP.valid, LOOP.composed, LOOP.attached]) {
    bell(done, 88, 0.11, 0.3);
    bell(done + 0.12, 93, 0.08, -0.3);
  }

  riser(30, 2, 0.18);
  clapRoll(31, 32, 0.2);

  // 32–43 · the review
  hit(HITS.review, 0.85);
  pulse(32.5, 42.5, 'four');
  marimba(32, 43);
  marimba(32, 43, { octave: 12, gain: 0.035, offset: BEAT / 2 });
  sub(32.5, 42.5, 'halves');
  air(32, 43, 0.032, 2400);
  sparkle(32, 36, 0.06);
  chordHit(REVIEW.after, 0.09);
  melody([
    [36.63, 76, 0.45],
    [37.13, 74, 0.45],
    [37.63, 72, 0.45],
    [38.13, 74, 0.45],
    [38.63, 72, 0.9],
    [39.63, 69, 0.9],
    [40.63, 76, 0.45],
    [41.13, 79, 0.45],
    [41.63, 76, 0.9],
  ]);
  riser(42, 1, 0.12);

  // 43–50 · outro
  hit(HITS.outro, 1);
  pad(43, PROGRESSION[0].voicing, 6.5, 0.06, 2400);
  pad(43, [45, 52], 6.5, 0.04, 900);
  bass(43, 45, 6, 0.24, 0.5);
  marimba(43, 47, { gain: 0.05, cutoff: 1200 });
  motif(44.2, 0.14);
  boom(HITS.logo, 0.5);
  crash(HITS.logo, 0.1, 2.4);
  bell(HITS.logo + 0.4, 69, 0.13);
  bell(HITS.logo + 0.4, 76, 0.09, 0.3);

  for (const t of WHOOSHES) whoosh(t, 0.22);
};
