import type { VideoConfig } from '@/core/types';
import DefaultConfig from '@/core/default.config';

// Resolve the output orientation ONCE, here — the single point where the descriptor and the project
// config meet. A portrait template swaps the configured W:H, and a square template forces the 1080x1080
// preset, so the recorded clip, the cards, and the final normalize all render to the same scale.
// Pure so TemplateDirector.applyOrientationToScale stays a one-line assignment (line-budget friendly).
export const resolveOrientationScale = (
  videoConfig: VideoConfig | undefined,
  orientation: string | undefined
): VideoConfig | undefined => {
  if (!videoConfig) return videoConfig;

  if (orientation === 'square') {
    return { ...videoConfig, scale: DefaultConfig.SQUARE_SCALE };
  }

  if (orientation !== 'portrait') return videoConfig;

  const parts = videoConfig.scale?.split(':');
  const [width, height] = [parts?.[0], parts?.[1]];

  if (width === undefined || height === undefined) return videoConfig;

  return { ...videoConfig, scale: `${height}:${width}` };
};

// Resolve the output fps ONCE, mirroring resolveOrientationScale: the descriptor's global.fps wins over
// any host-supplied videoConfig.fps; consumers read videoConfig.fps ?? DefaultConfig.FPS.
export const resolveFps = (videoConfig: VideoConfig | undefined, fps: number | undefined): VideoConfig | undefined => {
  if (!fps) return videoConfig;

  return { ...videoConfig, fps };
};
