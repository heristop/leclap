import { KineticBlocksSchema } from './kinetic.schemas';
import { CameraSchema } from './camera.schemas';
import { GraphicsSchema } from './graphics.schemas';

// The motion fields every visual section accepts: animated copy, a
// virtual camera and animated graphics. Spread into the section base so each section type gets them.
export const MOTION_SECTION_FIELDS = {
  kinetic: KineticBlocksSchema.optional(),
  camera: CameraSchema.optional(),
  graphics: GraphicsSchema.optional(),
};
