// Pure preview layout for the titleCard sugar (kicker / headline / subtitle on a color section).
// Mirrors the engine's titleCardToFilters (packages/ffmpeg-video-composer/src/editor/presets/
// text-blocks.ts): the same margins, y positions, font files and colours, computed in engine px
// (with the engine's rounding) then rescaled to the preview frame. Reveal/fade are entrance
// animations — the preview renders the resting (fully revealed) state.
import type { TitleCard, Orientation } from '../templateEditorModel';
import {
  ENGINE_FRAME,
  previewScale,
  translationText,
  type SugarAnchorX,
  type SugarBar,
  type SugarTextLine,
} from './sugarPreviewGeometry';

export interface TitleCardPreview {
  lines: SugarTextLine[];
  /** The accent underline bar, or null when no accent colour is set. */
  bar: SugarBar | null;
}

// One line's engine spec: the raw fractions of the engine frame the compiler uses.
type LineSpec = {
  key: string;
  text: string;
  yFrac: number;
  sizeFrac: number;
  fontFamily: string;
  color: string;
};

/**
 * Lays out a titleCard as positioned preview boxes, or null when the card has no text at all
 * (matching the engine's empty-card guard). Lines the author left blank are skipped, exactly like
 * the engine's pushLine.
 */
export function titleCardPreview(
  card: TitleCard | undefined,
  previewH: number,
  orientation: Orientation
): TitleCardPreview | null {
  if (!card) return null;

  const kicker = translationText(card.kicker);
  const headline = translationText(card.headline);
  const subtitle = translationText(card.subtitle);

  if (kicker.trim() === '' && headline.trim() === '' && subtitle.trim() === '') return null;

  const { w, h } = ENGINE_FRAME[orientation];
  const f = previewScale(previewH, orientation);
  const margin = Math.round(w * 0.06);
  const align = card.align ?? 'left';
  const accent = card.accent;
  const x: SugarAnchorX = align === 'center' ? { side: 'center' } : { side: 'left', px: margin * f };

  const specs: LineSpec[] = [
    { key: 'kicker', text: kicker, yFrac: 0.4, sizeFrac: 0.026, fontFamily: 'Oswald', color: accent ?? '#ffffff' },
    { key: 'headline', text: headline, yFrac: 0.452, sizeFrac: 0.085, fontFamily: 'Anton', color: '#ffffff' },
    { key: 'subtitle', text: subtitle, yFrac: 0.63, sizeFrac: 0.03, fontFamily: 'Oswald', color: '#cfd3de' },
  ];

  const lines: SugarTextLine[] = specs
    .filter((spec) => spec.text.trim() !== '')
    .map((spec) => ({
      key: spec.key,
      text: spec.text,
      x,
      y: { edge: 'top', px: Math.round(h * spec.yFrac) * f },
      fontPx: Math.round(h * spec.sizeFrac) * f,
      fontFamily: spec.fontFamily,
      color: spec.color,
      // The engine applies the card effect to every pushLine (text-blocks.ts titleCardToFilters).
      ...(card.effect ? { effect: card.effect } : {}),
    }));

  const bar: SugarBar | null = accent
    ? {
        x,
        topPx: Math.round(h * 0.585) * f,
        widthPx: Math.round(w * 0.13) * f,
        heightPx: Math.max(4, Math.round(h * 0.006)) * f,
        color: accent,
      }
    : null;

  return { lines, bar };
}
