import type { Filter, Section, TemplateDescriptorGlobal } from '@/core/types';
import type { Grade, MotionEffect, BackgroundLayer } from '../../schemas/template.schemas';
import { layersToFilters, motionToFilters, gradeToFilters, lookToFilters } from './looks';
import { captionToFilters } from './captions';
import { titleCardToFilters, lowerThirdToFilters, globalTextOverlayToFilters } from './text-blocks';

// Context a sugar compiler needs to lower time/space-dependent effects (motion calibrates its
// Ken Burns curve over the clip length and scale). Built once per section by SegmentBuilder.
export type SugarContext = {
  duration: number;
  /** Output scale as 'W:H', e.g. '1280:720'. */
  scale: string;
  fps: number;
  /** True for real footage (project_video/video) so motion advances one output frame per input frame. */
  isVideo: boolean;
};

// Where a sugar's filters sit relative to an animation/gradient overlay graph:
// - 'background' bakes into the video before overlays (colour grade, motion, layers).
// - 'overlay' draws on top of the composited frame (text: caption, titleCard, lowerThird) so it is
//   visible above an animation overlay rather than buried under it.
export type SugarLayer = 'background' | 'overlay';

// A single structured-sugar field (look/grade/motion/caption/…) and how it lowers to raw filters.
// `order` fixes its position in the section's filter chain; lower runs first. Registering a new
// sugar is one entry here — SegmentBuilder reads the registry rather than hardcoding the set/order.
export type SugarCompiler = {
  key: string;
  order: number;
  layer: SugarLayer;
  compile: (section: Section, ctx: SugarContext) => Filter[];
};

// Order preserves the previous hardcoded chain: layers → motion → grade → look → caption.
export const SUGAR_COMPILERS: SugarCompiler[] = [
  {
    key: 'layers',
    order: 10,
    layer: 'background',
    compile: (section) => layersToFilters(section.options?.layers as BackgroundLayer[] | undefined),
  },
  {
    key: 'motion',
    order: 20,
    layer: 'background',
    compile: (section, ctx) => motionToFilters(section.motion as MotionEffect[] | undefined, ctx),
  },
  {
    key: 'grade',
    order: 30,
    layer: 'background',
    compile: (section) => gradeToFilters(section.grade as Grade | undefined),
  },
  {
    key: 'look',
    order: 40,
    layer: 'background',
    compile: (section) => lookToFilters(section.look),
  },
  {
    key: 'caption',
    order: 50,
    layer: 'overlay',
    compile: (section) => captionToFilters(section.caption),
  },
  {
    key: 'titleCard',
    order: 55,
    layer: 'overlay',
    compile: (section, ctx) =>
      titleCardToFilters(section.titleCard, { scale: ctx.scale, backgroundColor: section.options?.backgroundColor }),
  },
  {
    key: 'lowerThird',
    order: 58,
    layer: 'overlay',
    compile: (section, ctx) => lowerThirdToFilters(section.lowerThird, { scale: ctx.scale }),
  },
];

/**
 * Lowers the section's structured-sugar fields into raw filters, split by layer and sorted by each
 * compiler's `order`. `background` filters bake into the video before overlays; `overlay` filters
 * (text) draw on top — the caller routes them onto the final map when an overlay graph exists.
 */
export function compileSugarLayers(section: Section, ctx: SugarContext): { background: Filter[]; overlay: Filter[] } {
  const sorted = [...SUGAR_COMPILERS].sort((a, b) => a.order - b.order);
  const select = (layer: SugarLayer): Filter[] =>
    sorted.filter((compiler) => compiler.layer === layer).flatMap((compiler) => compiler.compile(section, ctx));

  return { background: select('background'), overlay: select('overlay') };
}

/**
 * Lowers the GLOBAL decoration set (the whole-video siblings of the section sugar) for one section,
 * split by layer. `look`/`grade` apply across every section as background colour; text `overlays`
 * draw on top of every section (or a named subset) — the engine fans the once-authored decoration
 * out to each section, reusing the section's own draw-order routing and text formatting.
 */
export function compileGlobalDecorations(
  global: TemplateDescriptorGlobal | undefined,
  sectionName: string,
  ctx: SugarContext
): { background: Filter[]; overlay: Filter[] } {
  if (!global) {
    return { background: [], overlay: [] };
  }

  const background = [...lookToFilters(global.look), ...gradeToFilters(global.grade as Grade | undefined)];

  const overlay = (global.overlays ?? [])
    .filter((overlay) => overlay.sections === undefined || overlay.sections.includes(sectionName))
    .flatMap((overlay) => globalTextOverlayToFilters(overlay, { scale: ctx.scale }));

  return { background, overlay };
}
