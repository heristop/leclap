// The hero's two sounds, synthesised rather than sampled — no audio files ship, and nothing is
// fetched. A clapperboard clack is a short filtered noise burst (the slate) over a fast low thump
// (the body); the timeline tick is a single square blip. Both are built per-call and left to the
// garbage collector: these are one-shots, not an instrument.

let context: AudioContext | null = null;

type AudioContextCtor = typeof AudioContext;

function audioContext(): AudioContext | null {
  // Both spellings are optional here: neither exists during prerender, and older Safari only has the
  // prefixed one.
  const scope = globalThis as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  const Ctor = scope.AudioContext ?? scope.webkitAudioContext;

  if (!Ctor) return null;

  context ??= new Ctor();

  // Autoplay policy parks the context until a gesture; every caller here is gesture-driven.
  if (context.state === 'suspended') {
    context.resume().catch(() => {});
  }

  return context;
}

// A decaying burst of white noise — the slate hitting the board.
function noiseBurst(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const samples = buffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    samples[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }

  return buffer;
}

// The slate: a bandpassed noise burst, gone in about a tenth of a second.
function playSlate(ctx: AudioContext, now: number): void {
  const slate = ctx.createBufferSource();
  slate.buffer = noiseBurst(ctx, 0.14);

  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 1900;
  band.Q.value = 1.1;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.5, now + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);

  slate.connect(band).connect(gain).connect(ctx.destination);
  slate.start(now);
  slate.stop(now + 0.15);
}

// The body: a pitch-dropping sine under the slate, which is what makes it read as wood rather than
// a hiss.
function playBody(ctx: AudioContext, now: number): void {
  const body = ctx.createOscillator();
  body.type = 'sine';
  body.frequency.setValueAtTime(150, now);
  body.frequency.exponentialRampToValueAtTime(58, now + 0.1);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.32, now + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

  body.connect(gain).connect(ctx.destination);
  body.start(now);
  body.stop(now + 0.18);
}

/** The clapperboard clack. */
export function playClap(): void {
  const ctx = audioContext();

  if (!ctx) return;

  playSlate(ctx, ctx.currentTime);
  playBody(ctx, ctx.currentTime);
}

/** A single frame-step blip for the timeline scrubber. */
export function playTick(): void {
  const ctx = audioContext();

  if (!ctx) return;

  const now = ctx.currentTime;

  const blip = ctx.createOscillator();
  blip.type = 'square';
  blip.frequency.value = 2400;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.05, now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

  blip.connect(gain).connect(ctx.destination);
  blip.start(now);
  blip.stop(now + 0.04);
}
