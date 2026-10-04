// Motion fields the builder has no controls for yet (kinetic typography, the section camera, animated
// graphics, designed-transition easing, global.seed, global.motion tokens and the global.theme). The editor carries them
// through in descriptor shape, so opening a template in the builder and saving it never strips them.

import type { TemplateDescriptor } from 'ffmpeg-video-composer/src/core/types.d.ts';
import type { KineticBlock } from 'ffmpeg-video-composer/src/schemas/kinetic.schemas.ts';
import type { Camera } from 'ffmpeg-video-composer/src/schemas/camera.schemas.ts';
import type { Graphic } from 'ffmpeg-video-composer/src/schemas/graphics.schemas.ts';
import type { EasingSpecInput, MotionTokens } from 'ffmpeg-video-composer/src/schemas/motion.schemas.ts';
import type { Theme } from 'ffmpeg-video-composer/src/schemas/theme.schemas.ts';

export type MotionEase = EasingSpecInput;

/** Per-section motion blocks. */
export interface MotionBlocks {
  kinetic?: KineticBlock[];
  camera?: Camera;
  graphics?: Graphic[];
}

/** Template-wide motion settings. */
export interface EditorMotion {
  seed?: number;
  tokens?: MotionTokens;
  /** global.theme, carried verbatim: `$color.*` / `$font.*` references elsewhere depend on it. */
  theme?: Theme;
}

export function motionBlocksOf(source: MotionBlocks): MotionBlocks {
  return {
    ...(source.kinetic ? { kinetic: source.kinetic } : {}),
    ...(source.camera ? { camera: source.camera } : {}),
    ...(source.graphics ? { graphics: source.graphics } : {}),
  };
}

/** global.seed, global.motion and global.theme as editor state, or undefined when the template sets none. */
export function editorMotionFrom(global: TemplateDescriptor['global']): EditorMotion | undefined {
  const motion: EditorMotion = {
    ...(global?.seed === undefined ? {} : { seed: global.seed }),
    ...(global?.motion ? { tokens: global.motion } : {}),
    ...(global?.theme === undefined ? {} : { theme: global.theme }),
  };

  return Object.keys(motion).length > 0 ? motion : undefined;
}

/** The editor motion settings back as `global` fields. */
export function motionGlobalFrom(
  motion: EditorMotion | undefined
): Pick<NonNullable<TemplateDescriptor['global']>, 'seed' | 'motion' | 'theme'> {
  return {
    ...(motion?.seed === undefined ? {} : { seed: motion.seed }),
    ...(motion?.tokens ? { motion: motion.tokens } : {}),
    ...(motion?.theme === undefined ? {} : { theme: motion.theme }),
  };
}
