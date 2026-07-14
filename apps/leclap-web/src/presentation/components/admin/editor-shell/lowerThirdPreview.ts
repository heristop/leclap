// Pure preview layout for the lowerThird sugar (a title/subtitle band over a video clip). Mirrors
// the engine's lowerThirdToFilters (packages/ffmpeg-video-composer/src/editor/presets/text-blocks.ts):
// band colour/height, accent bar geometry, line positions/fonts and the right-aligned badge pill,
// computed in engine px (with the engine's rounding) then rescaled to the preview frame. Reveals are
// entrance animations — the preview renders the resting state.
import type { LowerThird, Orientation } from '../templateEditorModel';
import {
  ENGINE_FRAME,
  previewScale,
  translationText,
  type SugarBand,
  type SugarBar,
  type SugarTextLine,
} from './sugarPreviewGeometry';

// Engine constants from text-blocks.ts (BAND_COLOR / DEFAULT_BAND_OPACITY / badgePill's fallback).
const BAND_COLOR = '#0a0f14';
const DEFAULT_BAND_OPACITY = 0.6;
const DEFAULT_BADGE_ACCENT = '#7C83FF';

export interface LowerThirdPreview {
  /** The translucent legibility band, or null at boxOpacity 0. */
  band: SugarBand | null;
  /** The accent bar, or null when no accent colour is set. */
  bar: SugarBar | null;
  /** Title, subtitle and badge lines, in engine draw order (later entries paint on top). */
  lines: SugarTextLine[];
}

/**
 * Lays out a lowerThird as positioned preview boxes, or null when it has no text at all (matching
 * the engine's empty guard over title + subtitle + badge).
 */
interface LowerThirdParts {
  title: string;
  subtitle: string;
  badge: string;
  accent?: string;
  effect: LowerThird['effect'];
}

interface LowerThirdGeometry {
  f: number;
  h: number;
  margin: number;
  bandY: number;
}

// Title / subtitle / badge as positioned preview lines, in engine draw order (later paints on top).
// Empty strings are skipped. The engine applies the text effect to the title + subtitle only —
// badgePill never calls applyTextEffect (text-blocks.ts) — so the badge line stays effect-free.
function lowerThirdLines(parts: LowerThirdParts, geom: LowerThirdGeometry): SugarTextLine[] {
  const { title, subtitle, badge, accent, effect } = parts;
  const { f, h, margin, bandY } = geom;
  const effectPatch = effect ? { effect } : {};
  const lines: SugarTextLine[] = [];

  if (title.trim() !== '') {
    lines.push({
      key: 'title',
      text: title,
      x: { side: 'left', px: margin * f },
      y: { edge: 'top', px: (bandY + Math.round(h * 0.055)) * f },
      fontPx: Math.round(h * 0.05) * f,
      fontFamily: 'Anton',
      color: '#ffffff',
      ...effectPatch,
    });
  }

  if (subtitle.trim() !== '') {
    lines.push({
      key: 'subtitle',
      text: subtitle,
      x: { side: 'left', px: margin * f },
      y: { edge: 'top', px: (bandY + Math.round(h * 0.125)) * f },
      fontPx: Math.round(h * 0.028) * f,
      fontFamily: 'Oswald',
      color: '#c9d0f5',
      ...effectPatch,
    });
  }

  if (badge.trim() !== '') {
    lines.push({
      key: 'badge',
      text: badge,
      x: { side: 'right', px: margin * f },
      y: { edge: 'top', px: (bandY + Math.round(h * 0.055)) * f },
      fontPx: Math.round(h * 0.04) * f,
      fontFamily: 'Anton',
      // Dark text on the accent pill; white on the default pill (engine badgePill).
      color: accent ? BAND_COLOR : '#ffffff',
      box: { color: accent ?? DEFAULT_BADGE_ACCENT, opacity: 1, paddingPx: Math.max(8, Math.round(h * 0.014)) * f },
    });
  }

  return lines;
}

export function lowerThirdPreview(
  lowerThird: LowerThird | undefined,
  previewH: number,
  orientation: Orientation
): LowerThirdPreview | null {
  if (!lowerThird) return null;

  const title = translationText(lowerThird.title);
  const subtitle = translationText(lowerThird.subtitle);
  const badge = translationText(lowerThird.badge);

  if (title.trim() === '' && subtitle.trim() === '' && badge.trim() === '') return null;

  const { w, h } = ENGINE_FRAME[orientation];
  const f = previewScale(previewH, orientation);
  const margin = Math.round(w * 0.06);
  const accent = lowerThird.accent;
  const bandH = Math.round(h * 0.2);
  const bandY = lowerThird.position === 'top' ? 0 : h - bandH;
  const opacity = lowerThird.boxOpacity ?? DEFAULT_BAND_OPACITY;

  const band: SugarBand | null =
    opacity > 0 ? { topPx: bandY * f, heightPx: bandH * f, color: BAND_COLOR, opacity } : null;

  const bar: SugarBar | null = accent
    ? {
        x: { side: 'left', px: margin * f },
        topPx: (bandY + Math.round(h * 0.04)) * f,
        widthPx: Math.round(w * 0.1) * f,
        heightPx: Math.max(4, Math.round(h * 0.006)) * f,
        color: accent,
      }
    : null;

  const lines = lowerThirdLines({ title, subtitle, badge, accent, effect: lowerThird.effect }, { f, h, margin, bandY });

  return { band, bar, lines };
}
