// Shared geometry for the WYSIWYG text-sugar previews (titleCard / lowerThird / caption). The engine
// lowers each sugar to drawtext/drawbox filters positioned in ABSOLUTE output pixels (see
// packages/ffmpeg-video-composer/src/editor/presets/text-blocks.ts and captions.ts); these helpers
// reproduce that engine-pixel geometry and rescale it to the preview frame so the monitor matches the
// final render. Pure data in/out — the React layer (SugarPreviewLayer) only maps boxes to styles.
import type { Orientation, TextEffect } from '../templateEditorModel';

// The engine's output resolution per orientation: landscape is DefaultConfig.SCALE (1280x720),
// square is DefaultConfig.SQUARE_SCALE (1080x1080), and portrait swaps the landscape W:H
// (TemplateDirector.applyOrientationToScale → 720x1280).
export const ENGINE_FRAME: Record<Orientation, { w: number; h: number }> = {
  landscape: { w: 1280, h: 720 },
  portrait: { w: 720, h: 1280 },
  square: { w: 1080, h: 1080 },
};

// Horizontal anchor of a sugar box, mirroring the drawtext x expressions: a left margin (x = px),
// centered (x = (w-text_w)/2), or a right margin (x = w-text_w-px).
export type SugarAnchorX = { side: 'left'; px: number } | { side: 'center' } | { side: 'right'; px: number };

// Vertical anchor, mirroring the drawtext y expressions: a top offset (y = px), centered
// (y = (h-text_h)/2), or a bottom offset (y = h-text_h-px).
export type SugarAnchorY = { edge: 'top'; px: number } | { edge: 'center' } | { edge: 'bottom'; px: number };

// A drawtext `box=1` background: colour at an opacity with `boxborderw` padding.
export interface SugarTextBox {
  color: string;
  opacity: number;
  paddingPx: number;
}

// One positioned, styled text line — a single drawtext lowered to preview px.
export interface SugarTextLine {
  /** Stable render key ('kicker' | 'headline' | 'subtitle' | 'title' | 'badge' | 'caption'). */
  key: string;
  text: string;
  x: SugarAnchorX;
  y: SugarAnchorY;
  fontPx: number;
  /** CSS font family from the shared font registry. */
  fontFamily: string;
  color: string;
  box?: SugarTextBox;
  /**
   * The sugar's drop shadow / outline, passed through RAW (engine px) for the renderer to map to
   * CSS at its own scale (textEffectCss). Absent on lines the engine draws without it (the badge).
   */
  effect?: TextEffect;
}

// A solid accent bar (drawbox t=fill).
export interface SugarBar {
  x: SugarAnchorX;
  topPx: number;
  widthPx: number;
  heightPx: number;
  color: string;
}

// A full-width legibility band (drawbox x=0 w=iw).
export interface SugarBand {
  topPx: number;
  heightPx: number;
  color: string;
  opacity: number;
}

// The preview-px per engine-px factor. Widths use the same factor as heights because the preview
// frame keeps the engine aspect ratio (previewW/engineW === previewH/engineH).
export const previewScale = (previewH: number, orientation: Orientation): number =>
  previewH / ENGINE_FRAME[orientation].h;

// Resolve a Translation record to its display line: the english value when present (the builder
// writes { en }), otherwise the first non-blank translation (imported descriptors may be fr-only).
// Mirrors the engine's hasText "any non-blank value" semantics.
export function translationText(line: Record<string, string> | undefined): string {
  if (!line) return '';

  // `en` is typed as string but the key may be absent at runtime (imported fr-only descriptors); the
  // truthiness guard covers both the missing key and an empty/blank value.
  const en = line.en;

  if (en && en.trim() !== '') return en;

  return Object.values(line).find((value) => value.trim() !== '') ?? '';
}
