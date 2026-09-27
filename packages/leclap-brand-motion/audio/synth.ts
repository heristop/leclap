// The films' synthesiser — no samples, no plugins: every sound is built from oscillators and noise.
// `createScore(duration)` returns the instruments and arrangement helpers on fresh buses; a film's
// arrangement (audio/scores/*.ts) calls them at its cue points, then `write()` mixes (sidechain pump,
// a Freeverb-style room, soft clip, fade, -1 dBFS) and writes a 48 kHz stereo 16-bit WAV.
//
// Both films share one musical grid: A minor, 120 BPM (a beat is 0.5 s, a bar 2 s), Am – F – C – G.
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

export const BEAT = 0.5;
export const BAR = 2;

export const createScore = (duration: number) => {
  const SR = 48000;
  const TAIL = 2.5;
  const N = Math.ceil((duration + TAIL) * SR);

  // Three stereo buses: dry, a sidechained "pump" bus (bass + pads duck under the kick) and a reverb send.
  const dryL = new Float32Array(N);
  const dryR = new Float32Array(N);
  const pumpL = new Float32Array(N);
  const pumpR = new Float32Array(N);
  const sendL = new Float32Array(N);
  const sendR = new Float32Array(N);

  type Bus = 'dry' | 'pump';

  // A tiny deterministic PRNG, so the noise (and therefore the file) is identical on every run.
  const rng = (() => {
    let state = 0x9e3779b9;

    return (): number => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;

      return ((state >>> 0) / 0xffffffff) * 2 - 1;
    };
  })();

  const midi = (note: number): number => 440 * 2 ** ((note - 69) / 12);

  /** Equal-power pan, -1 (left) … 1 (right). */
  const panGains = (pan: number): [number, number] => {
    const angle = ((pan + 1) / 4) * Math.PI;

    return [Math.cos(angle), Math.sin(angle)];
  };

  interface Voice {
    at: number;
    dur: number;
    bus?: Bus;
    pan?: number;
    send?: number;
    /** Returns the mono sample `t` seconds into the voice, or a [left, right] pair for stereo voices. */
    sample: (t: number) => number | readonly [number, number];
  }

  const play = ({ at, dur, bus = 'dry', pan = 0, send = 0, sample }: Voice): void => {
    const start = Math.max(0, Math.round(at * SR));
    const end = Math.min(N, Math.round((at + dur) * SR));
    const [gl, gr] = panGains(pan);
    const outL = bus === 'pump' ? pumpL : dryL;
    const outR = bus === 'pump' ? pumpR : dryR;

    for (let i = start; i < end; i += 1) {
      const value = sample((i - start) / SR);
      const left = typeof value === 'number' ? value * gl : value[0];
      const right = typeof value === 'number' ? value * gr : value[1];

      outL[i] += left;
      outR[i] += right;
      sendL[i] += left * send;
      sendR[i] += right * send;
    }
  };

  // ─── oscillators & filters ──────────────────────────────────────────────────────────────────────

  /** Band-limited-ish saw via a polyBLEP correction — keeps the high end from fizzing. */
  const saw = (phase: number, inc: number): number => {
    const p = phase % 1;
    const naive = 2 * p - 1;

    if (p < inc) {
      const x = p / inc;

      return naive - (x + x - x * x - 1);
    }

    if (p > 1 - inc) {
      const x = (p - 1) / inc;

      return naive - (x * x + x + x + 1);
    }

    return naive;
  };

  /** A one-pole low-pass whose cutoff can move every sample. */
  const onePole = () => {
    let y = 0;

    return (x: number, cutoff: number): number => {
      const a = 1 - Math.exp((-2 * Math.PI * Math.min(cutoff, SR * 0.45)) / SR);
      y += a * (x - y);

      return y;
    };
  };

  /** Chamberlin state-variable filter: returns low/band/high outputs for a moving cutoff. */
  const svf = (q = 0.7) => {
    let low = 0;
    let band = 0;

    return (x: number, cutoff: number): { low: number; band: number; high: number } => {
      const f = 2 * Math.sin((Math.PI * Math.min(cutoff, SR * 0.2)) / SR);
      const high = x - low - band / q;
      band += f * high;
      low += f * band;

      return { low, band, high };
    };
  };

  const expDecay = (t: number, rate: number): number => Math.exp(-t * rate);

  /** Linear attack, exponential release after `hold`. */
  const adsr = (t: number, attack: number, hold: number, release: number): number => {
    if (t < attack) return t / attack;

    if (t < hold) return 1;

    return Math.exp(-(t - hold) / release);
  };

  // ─── instruments ────────────────────────────────────────────────────────────────────────────────

  const kickTimes: number[] = [];

  const kick = (at: number, gain = 1): void => {
    kickTimes.push(at);
    let phase = 0;
    play({
      at,
      dur: 0.5,
      sample: (t) => {
        const f = 44 + 120 * Math.exp(-t * 30);
        phase += f / SR;
        const body = Math.sin(2 * Math.PI * phase) * expDecay(t, 6.5);
        const click = rng() * expDecay(t, 350) * 0.25;

        return Math.tanh((body + click) * 1.6) * gain * 0.9;
      },
    });
  };

  /** The film-trailer impact: a falling sub, a filtered noise burst, and a long tail into the reverb. */
  const boom = (at: number, gain = 1): void => {
    let phase = 0;
    const lp = onePole();
    play({
      at,
      dur: 4,
      send: 0.35,
      sample: (t) => {
        const f = 30 + 55 * Math.exp(-t * 5);
        phase += f / SR;
        const sub = Math.sin(2 * Math.PI * phase) * expDecay(t, 1.1);
        const rumble = lp(rng(), 900 * Math.exp(-t * 2) + 60) * expDecay(t, 2.2) * 1.4;

        return Math.tanh((sub + rumble) * 1.3) * gain;
      },
    });
  };

  const crash = (at: number, gain = 0.5, length = 3): void => {
    const hpL = svf(0.8);
    const hpR = svf(0.8);
    play({
      at,
      dur: length,
      send: 0.12,
      sample: (t) => {
        const env = expDecay(t, 2.2 / length) * gain * (t < 0.002 ? t / 0.002 : 1);

        return [hpL(rng(), 6500).high * env, hpR(rng(), 6500).high * env] as const;
      },
    });
  };

  const clap = (at: number, gain = 0.5, pan = 0): void => {
    const bp = svf(1.4);
    play({
      at,
      dur: 0.45,
      pan,
      send: 0.35,
      sample: (t) => {
        const bursts = [0, 0.011, 0.022].reduce(
          (sum, offset) => (t >= offset ? sum + expDecay(t - offset, 380) : sum),
          0
        );
        const env = bursts * 0.7 + expDecay(t, 16);

        return bp(rng(), 1300).band * env * gain * 2.2;
      },
    });
  };

  const hat = (at: number, gain = 0.18, open = false, pan = 0.25): void => {
    const hp = svf(0.9);
    play({
      at,
      dur: open ? 0.4 : 0.08,
      pan,
      sample: (t) => hp(rng(), 8200).high * expDecay(t, open ? 9 : 55) * gain,
    });
  };

  const tick = (at: number, gain = 0.12): void => {
    play({
      at,
      dur: 0.05,
      pan: 0.3,
      send: 0.2,
      sample: (t) => Math.sin(2 * Math.PI * 2400 * t) * expDecay(t, 90) * gain,
    });
  };

  const heartbeat = (at: number, gain = 0.55): void => {
    for (const [index, offset] of [0, 0.19].entries()) {
      play({
        at: at + offset,
        dur: 0.35,
        sample: (t) => Math.sin(2 * Math.PI * (58 - t * 30) * t) * expDecay(t, 11) * gain * (index === 0 ? 1 : 0.7),
      });
    }
  };

  /** A music-box bell: sine + inharmonic partial, long ring. The film's recurring motif. */
  const bell = (at: number, note: number, gain = 0.16, pan = 0): void => {
    const f = midi(note);
    play({
      at,
      dur: 1.8,
      pan,
      send: 0.55,
      sample: (t) =>
        (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * f * 2.76 * t) * expDecay(t, 6)) *
        expDecay(t, 2.6) *
        gain,
    });
  };

  const bass = (at: number, note: number, dur: number, gain = 0.32, bright = 1): void => {
    const f = midi(note);
    const inc = f / SR;
    const lp = onePole();
    let pa = 0;
    let pb = 0.37;
    play({
      at,
      dur: dur + 0.05,
      bus: 'pump',
      sample: (t) => {
        pa += inc;
        pb += inc * 1.006;
        const osc = saw(pa, inc) + saw(pb, inc * 1.006) + Math.sin(2 * Math.PI * pa) * 1.2;
        const cutoff = (220 + 1400 * Math.exp(-t * 9)) * bright;
        const env = adsr(t, 0.004, dur - 0.02, 0.02);

        return lp(osc, cutoff) * env * gain;
      },
    });
  };

  interface PluckOptions {
    gain?: number;
    cutoff?: number;
    pan?: number;
    square?: boolean;
  }

  /** A plucked saw/square with a dotted-eighth echo thrown to the other side. */
  const pluck = (
    at: number,
    note: number,
    { gain = 0.1, cutoff = 2400, pan = -0.35, square = false }: PluckOptions = {}
  ): void => {
    const f = midi(note);
    const inc = f / SR;
    const voice = (delay: number, level: number, side: number): void => {
      const lp = onePole();
      let phase = 0;
      play({
        at: at + delay,
        dur: 0.7,
        pan: side,
        send: 0.3,
        sample: (t) => {
          phase += inc;
          const osc = square ? (phase % 1 < 0.5 ? 1 : -1) * 0.6 : saw(phase, inc);

          return lp(osc, cutoff * Math.exp(-t * 7) + 180) * expDecay(t, 6) * gain * level;
        },
      });
    };

    voice(0, 1, pan);
    voice(BEAT * 0.75, 0.38, -pan);
  };

  const pad = (at: number, notes: readonly number[], dur: number, gain = 0.07, cutoff = 1400): void => {
    for (const [index, note] of notes.entries()) {
      for (const [spread, detune] of [-0.08, 0, 0.08].entries()) {
        const f = midi(note + detune);
        const inc = f / SR;
        const lp = onePole();
        let phase = (index * 0.13 + spread * 0.29) % 1;
        play({
          at,
          dur: dur + 1.4,
          bus: 'pump',
          pan: (spread - 1) * 0.7,
          send: 0.45,
          sample: (t) => {
            phase += inc;

            return lp(saw(phase, inc), cutoff) * adsr(t, 0.6, dur, 0.5) * gain;
          },
        });
      }
    }
  };

  const stab = (at: number, notes: readonly number[], gain = 0.09): void => {
    for (const [index, note] of notes.entries()) {
      const f = midi(note + 12);
      const inc = f / SR;
      const lp = onePole();
      let phase = index * 0.21;
      play({
        at,
        dur: 0.6,
        pan: (index - 1) * 0.5,
        send: 0.45,
        sample: (t) => {
          phase += inc;

          return lp(saw(phase, inc), 4200 * Math.exp(-t * 9) + 500) * expDecay(t, 5) * gain;
        },
      });
    }
  };

  const lead = (at: number, note: number, dur: number, gain = 0.085): void => {
    const f = midi(note);
    const lp = onePole();
    let pa = 0;
    let pb = 0.5;
    play({
      at,
      dur: dur + 0.3,
      send: 0.4,
      sample: (t) => {
        const vibrato = 1 + 0.004 * Math.sin(2 * Math.PI * 5.5 * t) * Math.min(1, t * 3);
        const inc = (f * vibrato) / SR;
        pa += inc;
        pb += inc * 1.008;

        return [
          lp(saw(pa, inc), 3200) * adsr(t, 0.01, dur, 0.12) * gain,
          lp(saw(pb, inc), 3200) * adsr(t, 0.01, dur, 0.12) * gain,
        ] as const;
      },
    });
  };

  /** Noise riser: a band-pass climbing from 250 Hz to 9 kHz under a swelling sine, ending on `at + dur`. */
  const riser = (at: number, dur: number, gain = 0.22): void => {
    const bpL = svf(2.2);
    const bpR = svf(2.2);
    let phase = 0;
    play({
      at,
      dur,
      send: 0.25,
      sample: (t) => {
        const x = t / dur;
        const cutoff = 250 * (9000 / 250) ** x;
        phase += (180 + 900 * x * x) / SR;
        const tone = Math.sin(2 * Math.PI * phase) * 0.25;
        const amp = x ** 2.2 * gain;

        return [(bpL(rng(), cutoff).band * 1.8 + tone) * amp, (bpR(rng(), cutoff).band * 1.8 + tone) * amp] as const;
      },
    });
  };

  /** A whoosh that sweeps down and pans across, peaking at `at`. */
  const whoosh = (at: number, gain = 0.3): void => {
    const bp = svf(1.6);
    const dur = 0.9;
    play({
      at: at - dur * 0.6,
      dur,
      send: 0.2,
      sample: (t) => {
        const x = t / dur;
        const env = Math.sin(Math.PI * x) ** 2;
        const value = bp(rng(), 6500 * (1 - x) + 350).band * env * gain * 2;
        const [gl, gr] = panGains(-0.8 + 1.6 * x);

        return [value * gl, value * gr] as const;
      },
    });
  };

  // ─── arrangement ────────────────────────────────────────────────────────────────────────────────

  interface Chord {
    root: number;
    voicing: readonly number[];
  }

  // Am – F – C – G, voiced for smooth leading between pads.
  const PROGRESSION: readonly Chord[] = [
    { root: 33, voicing: [57, 60, 64] },
    { root: 29, voicing: [57, 60, 65] },
    { root: 36, voicing: [55, 60, 64] },
    { root: 31, voicing: [55, 59, 62] },
  ];

  const chordAt = (t: number): Chord => PROGRESSION[Math.floor(t / BAR + 1e-6) % PROGRESSION.length];

  /** Beat grid helper: every `step` seconds in [from, to). */
  const grid = (from: number, to: number, step: number): number[] => {
    const count = Math.round((to - from) / step);

    return Array.from({ length: count }, (_, index) => from + index * step);
  };

  const bars = (from: number, to: number): number[] => grid(from, to, BAR);

  // The music-box motif, played in the curtain, recalled in the breakdown and the finale.
  const MOTIF: readonly (readonly [number, number])[] = [
    [0, 76],
    [0.4, 81],
    [0.8, 83],
    [1.2, 84],
    [2.0, 83],
    [2.4, 79],
    [2.8, 76],
  ];

  const motif = (at: number, gain = 0.16): void => {
    for (const [index, [offset, note]] of MOTIF.entries()) bell(at + offset, note, gain, index % 2 === 0 ? -0.3 : 0.3);
  };

  const pads = (from: number, to: number, gain: number, cutoff: number): void => {
    for (const t of bars(from, to)) pad(t, chordAt(t).voicing, BAR - 0.1, gain, cutoff);
  };

  const bassLine = (from: number, to: number, pattern: 'eighths' | 'offbeat' | 'held', gain = 0.3): void => {
    if (pattern === 'held') {
      for (const t of bars(from, to)) bass(t, chordAt(t).root + 12, BAR - 0.05, gain, 0.7);

      return;
    }

    const step = BEAT / 2;

    for (const [index, t] of grid(from, to, step).entries()) {
      if (pattern === 'offbeat' && index % 2 === 0) continue;

      const octave = index % 4 === 3 ? 24 : 12;
      bass(t, chordAt(t).root + octave, step * 0.85, gain);
    }
  };

  const arp = (
    from: number,
    to: number,
    cutoffFrom: number,
    cutoffTo: number,
    opts: { square?: boolean; step?: number } = {}
  ): void => {
    const step = opts.step ?? BEAT / 4;
    const order = [0, 1, 2, 3, 2, 1, 2, 3];

    for (const [index, t] of grid(from, to, step).entries()) {
      const { voicing } = chordAt(t);
      const tones = [voicing[0] + 12, voicing[1] + 12, voicing[2] + 12, voicing[0] + 24];
      const x = (t - from) / (to - from);
      const cutoff = cutoffFrom + (cutoffTo - cutoffFrom) * x;
      pluck(t, tones[order[index % order.length]], {
        gain: 0.075,
        cutoff,
        pan: index % 2 === 0 ? -0.4 : 0.4,
        square: opts.square,
      });
    }
  };

  const drums = (from: number, to: number, style: 'A' | 'B' | 'C'): void => {
    for (const [index, t] of grid(from, to, BEAT).entries()) {
      kick(t, 0.95);

      if (style !== 'A' && index % 2 === 1) clap(t, 0.42);
    }

    for (const [index, t] of grid(from, to, BEAT / 2).entries()) {
      if (index % 2 === 1) hat(t, style === 'A' ? 0.14 : 0.17, style === 'B' && index % 8 === 7);
    }

    if (style !== 'C') return;

    for (const [index, t] of grid(from, to, BEAT / 4).entries()) {
      if (index % 2 === 1) hat(t, 0.07, false, -0.3);
    }
  };

  /** A snare-style roll that accelerates into `to`: 8ths, then 16ths, then 32nds. */
  const clapRoll = (from: number, to: number, gain = 0.3): void => {
    const span = to - from;
    const phases: readonly (readonly [number, number, number])[] = [
      [0, 0.5, BEAT / 2],
      [0.5, 0.75, BEAT / 4],
      [0.75, 1, BEAT / 8],
    ];

    for (const [a, b, step] of phases) {
      for (const t of grid(from + span * a, from + span * b, step)) {
        clap(t, gain * (0.5 + 0.5 * ((t - from) / span)), (Math.round(t * 16) % 3) * 0.2 - 0.2);
      }
    }
  };

  const impact = (at: number, strength = 1): void => {
    boom(at, strength);
    crash(at, 0.2 * strength, 2.4);
    kick(at, 1);
    stab(at, chordAt(at).voicing, 0.1 * strength);
  };

  /** Mix everything played so far and write the WAV. */
  const write = (outPath: string): void => {
    // ─── mixdown ────────────────────────────────────────────────────────────────────────────────────

    // Sidechain envelope: the pump bus dips under each kick and recovers over ~220 ms.
    const pumpEnv = new Float32Array(N).fill(1);

    for (const at of kickTimes) {
      const start = Math.round(at * SR);
      const len = Math.round(0.24 * SR);

      for (let i = 0; i < len && start + i < N; i += 1) {
        const x = i / len;
        pumpEnv[start + i] = Math.min(pumpEnv[start + i], 0.3 + 0.7 * x ** 0.7);
      }
    }

    // A Freeverb-style room: four damped combs + two all-passes per side.
    const reverb = (input: Float32Array, spread: number): Float32Array => {
      const out = new Float32Array(N);
      const combs = [1557, 1617, 1491, 1422].map((len) => ({ buf: new Float32Array(len + spread), idx: 0, store: 0 }));
      const allpasses = [556, 441].map((len) => ({ buf: new Float32Array(len + spread), idx: 0 }));

      for (let i = 0; i < N; i += 1) {
        const x = input[i] * 0.2;
        let y = 0;

        for (const comb of combs) {
          const value = comb.buf[comb.idx];
          comb.store = value * 0.75 + comb.store * 0.25;
          comb.buf[comb.idx] = x + comb.store * 0.86;
          comb.idx = (comb.idx + 1) % comb.buf.length;
          y += value;
        }

        for (const ap of allpasses) {
          const value = ap.buf[ap.idx];
          ap.buf[ap.idx] = y + value * 0.5;
          ap.idx = (ap.idx + 1) % ap.buf.length;
          y = value - y;
        }

        out[i] = y;
      }

      return out;
    };

    const wetL = reverb(sendL, 0);
    const wetR = reverb(sendR, 23);

    const mixL = new Float32Array(N);
    const mixR = new Float32Array(N);
    let hpStateL = 0;
    let hpStateR = 0;
    const hpA = Math.exp((-2 * Math.PI * 28) / SR);

    for (let i = 0; i < N; i += 1) {
      const l = dryL[i] + pumpL[i] * pumpEnv[i] + wetL[i] * 0.55;
      const r = dryR[i] + pumpR[i] * pumpEnv[i] + wetR[i] * 0.55;
      // DC / sub-rumble high-pass at 28 Hz.
      hpStateL = hpA * hpStateL + (1 - hpA) * l;
      hpStateR = hpA * hpStateR + (1 - hpA) * r;
      mixL[i] = Math.tanh((l - hpStateL) * 1.1);
      mixR[i] = Math.tanh((r - hpStateR) * 1.1);
    }

    // Fade the last seconds so the ring-out ends in silence, then normalise to -1 dBFS.
    const fadeFrom = Math.round((duration - 1.5) * SR);

    for (let i = fadeFrom; i < N; i += 1) {
      const g = Math.max(0, 1 - (i - fadeFrom) / (N - fadeFrom)) ** 2;
      mixL[i] *= g;
      mixR[i] *= g;
    }

    const peak = mixL.reduce((max, v, i) => Math.max(max, Math.abs(v), Math.abs(mixR[i])), 0);
    const norm = 0.89 / peak;

    const writeWav = (file: string): void => {
      const dataBytes = N * 4;
      const buffer = Buffer.alloc(44 + dataBytes);
      buffer.write('RIFF', 0);
      buffer.writeUInt32LE(36 + dataBytes, 4);
      buffer.write('WAVE', 8);
      buffer.write('fmt ', 12);
      buffer.writeUInt32LE(16, 16);
      buffer.writeUInt16LE(1, 20);
      buffer.writeUInt16LE(2, 22);
      buffer.writeUInt32LE(SR, 24);
      buffer.writeUInt32LE(SR * 4, 28);
      buffer.writeUInt16LE(4, 32);
      buffer.writeUInt16LE(16, 34);
      buffer.write('data', 36);
      buffer.writeUInt32LE(dataBytes, 40);

      for (let i = 0; i < N; i += 1) {
        buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mixL[i] * norm)) * 32767), 44 + i * 4);
        buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mixR[i] * norm)) * 32767), 46 + i * 4);
      }

      writeFileSync(file, buffer);
    };

    mkdirSync(path.dirname(outPath), { recursive: true });
    writeWav(outPath);
    console.log(
      `Wrote ${path.relative(process.cwd(), outPath)} — ${(N / SR).toFixed(1)}s, peak gain ${norm.toFixed(2)}`
    );
  };

  return {
    kick,
    boom,
    crash,
    clap,
    hat,
    tick,
    heartbeat,
    bell,
    bass,
    pluck,
    pad,
    stab,
    lead,
    riser,
    whoosh,
    PROGRESSION,
    chordAt,
    grid,
    bars,
    motif,
    pads,
    bassLine,
    arp,
    drums,
    clapRoll,
    impact,
    write,
  };
};

export type Score = ReturnType<typeof createScore>;
