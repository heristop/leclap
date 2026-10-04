// Pure filtergraph builders for the music mix and the loudness normalisation (MusicComposer). No IO.

import type { TemplateDescriptorGlobal } from '@/core/types';
import { LOUDNORM_INTEGRATED, LOUDNORM_TRUE_PEAK } from '@/core/qc/targets';

/** The single-pass loudnorm filter at a given true-peak ceiling (dBTP). */
export function loudnormFilter(ceiling: number = LOUDNORM_TRUE_PEAK): string {
  return `loudnorm=I=${LOUDNORM_INTEGRATED}:TP=${ceiling}:LRA=11`;
}

/**
 * Comma-prefixed normalize filter inserted at the end of the chain that produces [final] (a labeled
 * output ends an ffmpeg chain, so the filter must come BEFORE the label). '' when none is requested.
 */
export function normalizeSuffix(global: TemplateDescriptorGlobal | undefined, ceiling?: number): string {
  const normalize = global?.audio?.normalize;

  if (normalize === 'loudnorm') return `,${loudnormFilter(ceiling)}`;

  return normalize === 'dynaudnorm' ? ',dynaudnorm=f=150:g=15' : '';
}

/** Ducking mix: sidechain-compresses music under voice when ducking is enabled, then amix. */
export function duckingMix(
  global: TemplateDescriptorGlobal | undefined,
  labels: { music: string; voice: string },
  suffix: string
): string {
  const duckingConfig = global?.audio?.ducking;
  const isDucking = duckingConfig === true || typeof duckingConfig === 'object';

  if (!isDucking) {
    return `[${labels.voice}][${labels.music}]amix=inputs=2:duration=first${suffix}[final]`;
  }

  const cfg = typeof duckingConfig === 'object' ? duckingConfig : {};
  const sc = `sidechaincompress=threshold=${cfg.threshold ?? 0.05}:ratio=${cfg.ratio ?? 8}:attack=${cfg.attack ?? 20}:release=${cfg.release ?? 400}`;

  return (
    `[${labels.voice}]asplit=2[vout][vkey]; ` +
    `[${labels.music}][vkey]${sc}[ducked]; ` +
    `[vout][ducked]amix=inputs=2:duration=first:normalize=0${suffix}[final]`
  );
}

export interface MixGraphInput {
  global: TemplateDescriptorGlobal | undefined;
  /** The per-section music legs (MusicComposer.prepareMusicTrack), joined when there are several. */
  musicFilters: readonly string[];
  multipleSegments: boolean;
  audioVolumeLevel: number;
  reduceNoiseConfig: string;
  channelConfig: string;
  hasSegmentAudio: boolean;
  /** loudnorm true-peak ceiling for this pass (the true-peak guard lowers it on a retry). */
  ceiling?: number;
}

/** The music-mix `-filter_complex` producing `[final]`. */
export function musicMixGraph(input: MixGraphInput): string {
  const suffix = normalizeSuffix(input.global, input.ceiling);
  const { channelConfig } = input;
  const legs = input.multipleSegments ? `${input.musicFilters.join(' ')} [lastcrossed]` : '[1:a]';

  // Video-only upload: the concat output has no audio stream, so referencing `[0:a]` would abort
  // ("Stream specifier matches no streams"). Route the music straight to [final] instead of amix-ing it.
  if (!input.hasSegmentAudio) {
    return `${legs}${channelConfig}${suffix}[final]`;
  }

  const voice = `[0:a]${channelConfig},volume=${input.audioVolumeLevel},${input.reduceNoiseConfig}[audio_formatted]; `;
  const music = `${legs}${channelConfig}[music_formatted]; `;

  return `${voice}${music}${duckingMix(input.global, { music: 'music_formatted', voice: 'audio_formatted' }, suffix)}`;
}
