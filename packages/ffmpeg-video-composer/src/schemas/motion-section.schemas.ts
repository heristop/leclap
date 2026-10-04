import { KineticBlocksSchema } from './kinetic.schemas';
import { CameraSchema } from './camera.schemas';
import { GraphicsSchema } from './graphics.schemas';
import { CuesSchema } from './time.schemas';

// The motion fields every visual section accepts: animated copy, a virtual camera, animated graphics and
// named cue points for time references. Spread into the section base so each section type gets them.
export const MOTION_SECTION_FIELDS = {
  kinetic: KineticBlocksSchema.optional(),
  camera: CameraSchema.optional(),
  graphics: GraphicsSchema.optional(),
  cues: CuesSchema.optional(),
};
