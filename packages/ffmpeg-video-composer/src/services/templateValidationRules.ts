import { findFont } from '@/core/fonts';
import { DEFAULT_TRANSITION_DURATION } from '../schemas/effects.schemas';
import type { TemplateDescriptor, Section } from '../schemas/template.schemas';

export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

const RENDERING_SECTION_TYPES = new Set(['video', 'project_video', 'color_background', 'image_background']);

// Section types kenburns can zoom/pan: stills (image_background) and real footage (project_video,
// video). A solid color_background or non-rendering type (form, music) has nothing to pan.
const KENBURNS_SECTION_TYPES = new Set(['image_background', 'project_video', 'video']);

type IndexedSection = { section: Section; index: number };

// dangling_transition: non-cut transition on the last rendering section
function danglingTransitionErrors(renderingSections: IndexedSection[]): ValidationError[] {
  const { section: lastRendering, index: lastRenderingIndex } = renderingSections.at(-1) as IndexedSection;

  if (!lastRendering.transition || lastRendering.transition.type === 'cut') {
    return [];
  }

  return [
    {
      path: `sections[${lastRenderingIndex}].transition`,
      message: `Section "${lastRendering.name}": "${lastRendering.transition.type}" transition on the last rendering section has no following section to transition into`,
      code: 'dangling_transition',
    },
  ];
}

// transition_too_long: effective transition duration >= smaller of the two adjacent explicit durations
function transitionPairError(
  { section: sectionA, index: indexA }: IndexedSection,
  { section: sectionB }: IndexedSection,
  template: TemplateDescriptor
): ValidationError | null {
  if (!sectionA.transition || sectionA.transition.type === 'cut') {
    return null;
  }

  const durationA = sectionA.options?.duration;
  const durationB = sectionB.options?.duration;

  // Skip when either adjacent duration is undeclared
  if (durationA === undefined || durationB === undefined) {
    return null;
  }

  const effectiveDuration =
    sectionA.transition.duration ?? template.global?.transition?.duration ?? DEFAULT_TRANSITION_DURATION;
  const smaller = Math.min(durationA, durationB);

  if (effectiveDuration < smaller) {
    return null;
  }

  return {
    path: `sections[${indexA}].transition`,
    message: `Section "${sectionA.name}": effective transition duration ${effectiveDuration}s must be shorter than the smaller adjacent section duration ${smaller}s`,
    code: 'transition_too_long',
  };
}

function transitionLengthErrors(renderingSections: IndexedSection[], template: TemplateDescriptor): ValidationError[] {
  return renderingSections
    .slice(0, -1)
    .map((indexed, i) => transitionPairError(indexed, renderingSections[i + 1], template))
    .filter((error): error is ValidationError => error !== null);
}

export function validateTransitions(template: TemplateDescriptor): ValidationError[] {
  const sections = template.sections;

  if (!sections || sections.length === 0) {
    return [];
  }

  const renderingSections = sections
    .map((section, index) => ({ section, index }))
    .filter(({ section }) => RENDERING_SECTION_TYPES.has(section.type));

  if (renderingSections.length === 0) {
    return [];
  }

  return [...danglingTransitionErrors(renderingSections), ...transitionLengthErrors(renderingSections, template)];
}

// global_animation_missing_url: a whole-video overlay (global.animations) needs a resolvable url; an
// empty one stages nothing and the final overlay pass would fail. opacity range is enforced by the schema.
export function validateGlobalAnimations(template: TemplateDescriptor): ValidationError[] {
  const animations = template.global?.animations ?? [];

  return animations
    .map((animation, index): ValidationError | null => {
      if (animation.url && animation.url.trim() !== '') {
        return null;
      }

      return {
        path: `global.animations[${index}].url`,
        message: `Whole-video animation ${index} has no url`,
        code: 'global_animation_missing_url',
      };
    })
    .filter((error): error is ValidationError => error !== null);
}

// unknown_font: a sugar `font` (caption / whole-video overlay) that won't resolve — neither a bundled
// font id nor a `.ttf` filename — so the renderer would silently fall back to the default. Surfacing it
// catches typos (e.g. "Oswlad"). A `{{ var }}` is resolved at runtime, so it is left alone.
function isResolvableFont(font: string): boolean {
  return font.includes('{{') || font.endsWith('.ttf') || findFont(font) !== undefined;
}

const KNOWN_FONTS_HINT = 'known ids: rubik, oswald, bebas, … — or a .ttf filename';

export function validateFonts(template: TemplateDescriptor): ValidationError[] {
  const errors: ValidationError[] = [];
  const sections = template.sections ?? [];

  for (let index = 0; index < sections.length; index++) {
    const font = sections[index].caption?.font;

    if (font && !isResolvableFont(font)) {
      errors.push({
        path: `sections[${index}].caption.font`,
        message: `Section "${sections[index].name}": unknown caption font "${font}" (${KNOWN_FONTS_HINT})`,
        code: 'unknown_font',
      });
    }
  }

  const overlays = template.global?.overlays ?? [];

  for (let index = 0; index < overlays.length; index++) {
    const font = overlays[index].font;

    if (font && !isResolvableFont(font)) {
      errors.push({
        path: `global.overlays[${index}].font`,
        message: `Whole-video overlay ${index}: unknown font "${font}" (${KNOWN_FONTS_HINT})`,
        code: 'unknown_font',
      });
    }
  }

  return errors;
}

export function validateMotion(template: TemplateDescriptor): ValidationError[] {
  const errors: ValidationError[] = [];

  const sections = template.sections ?? [];

  for (let index = 0; index < sections.length; index++) {
    const section = sections[index];
    const hasKenburns = (section.motion ?? []).some((effect) => effect.type === 'kenburns');

    if (!hasKenburns) {
      continue;
    }

    if (KENBURNS_SECTION_TYPES.has(section.type)) {
      continue;
    }

    errors.push({
      path: `sections[${index}].motion`,
      message: `Section "${section.name}": kenburns motion requires a video or image_background section`,
      code: 'motion_unsupported_section',
    });
  }

  return errors;
}
