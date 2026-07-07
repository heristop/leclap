import type { SectionOptions } from '@/core/types';

type AudioFadeEntry = { duration: number; curve?: string };

function buildFadePart(type: 'in' | 'out', st: number, entry: AudioFadeEntry): string {
  const curveStr = entry.curve ? `:curve=${entry.curve}` : '';

  return `afade=t=${type}:st=${st}:d=${entry.duration}${curveStr}`;
}

/**
 * Builds the `-af` argument string for audio fades on a section, or returns '' when no
 * fades are configured or the section is muted (fades on a silent track are pointless).
 */
export function buildAudioFadeArg(opts: SectionOptions | undefined): string {
  if (opts?.muteSection === true) {
    return '';
  }

  const fade = opts?.audioFade;

  if (!fade?.in && !fade?.out) {
    return '';
  }

  const duration = opts?.duration ?? 0;
  const parts: string[] = [];

  if (fade.in) {
    parts.push(buildFadePart('in', 0, fade.in));
  }

  if (fade.out) {
    // A negative start would silence audio from t=0 when the section duration is
    // unknown or shorter than the fade.
    parts.push(buildFadePart('out', Math.max(0, duration - fade.out.duration), fade.out));
  }

  return ` -af "${parts.join(',')}" `;
}
