// Re-hydration helpers for the overlay inputs (animations + still images) of a stored section, plus the
// MediaChoice marker decoder. Split out of to-editor-state so each option-recovery step stays small.
import type { Section, GlobalAnimation, TemplateDescriptor } from 'ffmpeg-video-composer/src/core/types.d.ts';
import type { AnimationOverlay, ImageOverlay, MediaChoice, WatermarkChoice } from './model';

type StoredInput = NonNullable<Section['inputs']>[number];
type StoredInputOptions = NonNullable<StoredInput['options']>;

// Extent = whichever of duration / loops / loop:false is set (all default absent otherwise).
function overlayExtentFrom(o: Partial<GlobalAnimation>) {
  return {
    ...(o.duration === undefined ? {} : { duration: o.duration }),
    ...(o.loops === undefined ? {} : { loops: o.loops }),
    ...(o.loop === false ? { loop: false } : {}),
  };
}

// Placement (position / scale / fit / start); 'stretch' is the engine default fit so it stays absent.
function overlayPlacementFrom(o: Partial<GlobalAnimation>) {
  return {
    ...(o.position ? { position: o.position } : {}),
    ...(o.scale ? { scale: o.scale } : {}),
    ...(o.fit && o.fit !== 'stretch' ? { fit: o.fit } : {}),
    ...(o.start ? { start: o.start } : {}),
  };
}

// Appearance/playback flags carried only when non-default: persistent:false, a real fade (opacity < 1),
// nonzero rotation, flip, motion.
function overlayAppearanceFrom(o: Partial<GlobalAnimation>) {
  return {
    ...(o.persistent === false ? { persistent: false } : {}),
    ...(o.opacity !== undefined && o.opacity < 1 ? { opacity: o.opacity } : {}),
    ...(o.rotation ? { rotation: o.rotation } : {}),
    ...(o.flip ? { flip: o.flip } : {}),
    ...(o.motion ? { motion: o.motion } : {}),
  };
}

// Recover editor-facing overlay options (placement + playback) from a stored animation, carrying
// only explicit non-defaults. Active extent = whichever of duration / loops / loop:false is set.
export function overlayOptionsFrom(o: Partial<GlobalAnimation>): Omit<AnimationOverlay, 'id' | 'url' | 'label'> {
  return {
    ...overlayExtentFrom(o),
    ...overlayPlacementFrom(o),
    ...overlayAppearanceFrom(o),
  };
}

// Recover the animation overlays from the section's `type: 'animation'` inputs, in stored order. The
// editor-only `id` is derived from the input name so re-hydration is deterministic.
export function animationsFrom(s: Section): AnimationOverlay[] {
  return (s.inputs ?? [])
    .filter((i) => i.type === 'animation' && i.url)
    .map((input) => {
      return { id: input.name, url: input.url as string, ...overlayOptionsFrom(input.options ?? {}) };
    });
}

// Reverse markerFromChoice (buildDescriptor): the input url marker → a MediaChoice. `media://` uploads
// lose their human label across the descriptor, so fall back to the key as the display label.
export function choiceFromMarker(url: string): MediaChoice {
  if (url.startsWith('library://')) return { source: 'library', id: url.slice('library://'.length) };

  if (url.startsWith('media://')) {
    const key = url.slice('media://'.length);

    return { source: 'upload', key, label: key };
  }

  return { source: 'url', url };
}

// Recover the watermark (global.watermark) — the marker url decodes back into a MediaChoice via
// choiceFromMarker above; presentation fields carry through only when stored.
export function watermarkFrom(global: TemplateDescriptor['global']): WatermarkChoice | undefined {
  const w = global?.watermark;

  if (!w) return undefined;

  return {
    image: choiceFromMarker(w.url),
    ...(w.position ? { position: w.position } : {}),
    ...(w.scale === undefined ? {} : { scale: w.scale }),
    ...(w.opacity === undefined ? {} : { opacity: w.opacity }),
    ...(w.margin === undefined ? {} : { margin: w.margin }),
  };
}

// The stored show window is start/duration; the editor edits absolute start/end, so end = start +
// duration (trimmed of float noise — 0.1 + 0.2 must rehydrate as 0.3). Absent when no window stored.
function imageEndFrom(start: number | undefined, duration: number | undefined): { end?: number } {
  if (duration === undefined) return {};

  return { end: Number(((start ?? 0) + duration).toFixed(4)) };
}

// Placement/appearance of a still-image overlay. opacity defaults to opaque, so only carry an explicit
// fade (< 1) back, mirroring animationsFrom; 'stretch' fit stays absent.
function imagePlacementFrom(o: StoredInputOptions) {
  return {
    ...(o.position ? { position: o.position } : {}),
    ...(o.scale ? { scale: o.scale } : {}),
    ...(o.fit && o.fit !== 'stretch' ? { fit: o.fit } : {}),
    ...(o.opacity !== undefined && o.opacity < 1 ? { opacity: o.opacity } : {}),
    ...(o.rotation ? { rotation: o.rotation } : {}),
    ...(o.flip ? { flip: o.flip } : {}),
  };
}

// One stored `type: 'image'` input → an editor ImageOverlay. The editor-only `id` is derived from the
// input name so re-hydration is deterministic.
function imageOverlayFrom(input: StoredInput): ImageOverlay {
  const options = input.options ?? {};
  const { start, motion } = options;

  return {
    id: input.name,
    choice: choiceFromMarker(input.url as string),
    ...imagePlacementFrom(options),
    ...(start ? { start } : {}),
    ...imageEndFrom(start, options.duration),
    ...(motion ? { motion } : {}),
    // A builder-drawn shape re-hydrates its vector recipe so the shape controls come back;
    // without the field the data: URL stays a plain image.
    ...(input.shape ? { shape: input.shape } : {}),
  };
}

// Recover the still-image overlays from the section's `type: 'image'` inputs, in their stored order.
export function imagesFrom(s: Section): ImageOverlay[] {
  return (s.inputs ?? []).filter((i) => i.type === 'image' && i.url).map(imageOverlayFrom);
}
