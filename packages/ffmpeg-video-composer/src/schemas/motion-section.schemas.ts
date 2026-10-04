import { KineticBlocksSchema } from './kinetic.schemas';
import { CameraSchema } from './camera.schemas';
import { GraphicsSchema } from './graphics.schemas';
import { AssertionsSchema } from './assert.schemas';
import { CuesSchema } from './time.schemas';
import { SubtitlesSchema } from './subtitles.schemas';

// The motion fields every visual section accepts: animated copy, a virtual camera, animated graphics,
// named cue points for time references, the assertions that pin their timing and word-timed
// subtitles. Spread into the section base so each section type gets them.
export const MOTION_SECTION_FIELDS = {
  kinetic: KineticBlocksSchema.optional(),
  camera: CameraSchema.optional(),
  graphics: GraphicsSchema.optional(),
  assert: AssertionsSchema.optional(),
  cues: CuesSchema.optional(),
  subtitles: SubtitlesSchema.optional(),
};
