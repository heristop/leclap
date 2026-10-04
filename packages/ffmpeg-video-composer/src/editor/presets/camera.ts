import type { Filter, Section } from '@/core/types';
import type { Camera } from '../../schemas/camera.schemas';
import { cameraFilters } from '@/core/motion/camera';
import type { SugarContext } from './sugar-context';

// Where a section's camera runs. By default it moves the finished frame (text and graphics included), so
// it is appended at the very end of the chain by SegmentBuilder; `includeText: false` keeps overlays
// steady, so it lowers as background sugar beneath them instead.

function sectionCamera(section: Section, ctx: SugarContext): string[] {
  const camera = (section as { camera?: Camera }).camera;

  if (!camera || !ctx.motion) return [];

  const [width, height] = ctx.scale.split(':').map(Number);

  return cameraFilters(camera, {
    width,
    height,
    fps: ctx.fps,
    duration: ctx.duration,
    seed: ctx.motion.seedFor('camera'),
  });
}

/** Camera filters for the end of the chain (includeText, the default). */
export function cameraEndOfChain(section: Section, ctx: SugarContext): string[] {
  return (section as { camera?: Camera }).camera?.includeText === false ? [] : sectionCamera(section, ctx);
}

/** Camera filters as background sugar (includeText: false). */
export function cameraBackground(section: Section, ctx: SugarContext): Filter[] {
  if ((section as { camera?: Camera }).camera?.includeText !== false) return [];

  return sectionCamera(section, ctx).map((filter) => {
    const split = filter.indexOf('=');

    return { type: filter.slice(0, split), value: filter.slice(split + 1) };
  });
}
