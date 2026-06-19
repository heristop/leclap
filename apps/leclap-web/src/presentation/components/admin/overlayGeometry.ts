// Pure geometry helpers shared by the OverlayCanvas editor. They convert between
// the absolute video-pixel units the compiler emits (drawtext is absolute px) and
// the preview box's own pixel/fraction space, so what the author sees on the frame
// matches the rendered video (WYSIWYG sizing).

import type { Orientation } from './templateEditorModel';

// The reference video height the absolute `fontsize` is measured against (portrait 1920, square 1080,
// landscape 1080).
export const refVideoHeight = (orientation: Orientation): number => (orientation === 'portrait' ? 1920 : 1080);

// Preview px shown for a video-px `fontsize`, given the preview box height.
export const previewFontPx = (fontsize: number, previewH: number, orientation: Orientation): number =>
  fontsize * (previewH / refVideoHeight(orientation));

// Back-compute the video-px `fontsize` from a dragged preview height, clamped to
// a sane authoring range.
export const fontSizeFromPreview = (draggedH: number, previewH: number, orientation: Orientation): number =>
  Math.min(300, Math.max(8, Math.round((draggedH / previewH) * refVideoHeight(orientation))));

// Clamp a pointer offset within the box to a [0, 1] fraction.
export const clampFraction = (value: number, size: number): number => Math.min(1, Math.max(0, value / size));
