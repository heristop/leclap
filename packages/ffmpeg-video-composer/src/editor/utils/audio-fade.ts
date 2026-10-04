import type { SectionOptions } from '@/core/types';

type AudioFadeEntry = { duration: number; curve?: string };
type AudioEffect = 'echo' | 'telephone' | 'muffled';

// Voice-effect presets lowered onto the section `-af` chain, ahead of any fades. `telephone` is a
// two-filter comma chain in a single table value (highpass then lowpass) — not a FilterManager
// filter object, so it isn't FILTER_COMPAT-routed; see ENGINE_EMITTED_FILTERS/common.sh for the
// individual `aecho`/`highpass`/`lowpass` device-filter entries this table depends on.
const AUDIO_EFFECT_FILTERS: Record<AudioEffect, string> = {
  echo: 'aecho=0.8:0.7:60:0.4',
  telephone: 'highpass=f=300,lowpass=f=3400',
  muffled: 'lowpass=f=1200',
};

function buildFadePart(type: 'in' | 'out', st: number, entry: AudioFadeEntry): string {
  const curveStr = entry.curve ? `:curve=${entry.curve}` : '';

  return `afade=t=${type}:st=${st}:d=${entry.duration}${curveStr}`;
}

/** The fade-in part, if configured. */
function buildFadeInPart(fade: SectionOptions['audioFade']): string[] {
  if (!fade?.in) {
    return [];
  }

  return [buildFadePart('in', 0, fade.in)];
}

/** The fade-out part, if configured. A negative start would silence audio from t=0 when the
 * section duration is unknown or shorter than the fade, so the start clamps to 0. */
function buildFadeOutPart(fade: SectionOptions['audioFade'], duration: number): string[] {
  if (!fade?.out) {
    return [];
  }

  return [buildFadePart('out', Math.max(0, duration - fade.out.duration), fade.out)];
}

/**
 * Builds the `-af` argument string for a section's audio effect + fades, or returns '' when
 * neither is configured or the section is muted (processing a silent track is pointless).
 * Chain order: effect before fades, so echo/telephone/muffled shape the raw signal first and
 * the fades still ramp the final (already-effected) level in and out.
 *
 * `pad` appends `apad` for a clip's own (finite) audio encoded with `-shortest`: a phone clip whose
 * audio ends a few frames before its video would otherwise end the segment early, dropping those video
 * frames. Padded with silence, the audio never ends first, so `-shortest` (and `-t`) cut at the video.
 */
export function buildAudioFadeArg(opts: SectionOptions | undefined, pad = false): string {
  if (opts?.muteSection === true) {
    return '';
  }

  const effect = opts?.audioEffect;
  const parts: string[] = [
    ...(effect ? [AUDIO_EFFECT_FILTERS[effect]] : []),
    ...buildFadeInPart(opts?.audioFade),
    ...buildFadeOutPart(opts?.audioFade, opts?.duration ?? 0),
    ...(pad ? ['apad'] : []),
  ];

  if (parts.length === 0) {
    return '';
  }

  return ` -af "${parts.join(',')}" `;
}
