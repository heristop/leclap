// CSS approximation of the engine's TextEffect (drop shadow + outline). The engine lowers the
// effect to drawtext keys — shadowx/shadowy/shadowcolor and borderw/bordercolor
// (editor/presets/text.ts applyTextEffect) — with the defaults mirrored here (SHADOW_DEFAULTS /
// OUTLINE_DEFAULTS). The preview maps them to `text-shadow` and `-webkit-text-stroke`, scaled by the
// caller's engine-px → preview-px factor so the effect tracks the text size.
//
// Known compromise: CSS text-stroke paints INSIDE the glyph while drawtext's border strokes outside;
// at the preview's small widths (≈1px) the difference is invisible, and stroke stays crisp where a
// multi-offset text-shadow ring would blur.
import type { CSSProperties } from 'react';
import type { TextEffect } from '../templateEditorModel';
import { rgba } from './sectionCanvasColor';

// Engine defaults from editor/presets/text.ts.
const SHADOW_DEFAULTS = { color: '#000000@0.6', dx: 2, dy: 2 };
const OUTLINE_DEFAULTS = { color: '#000000', width: 2 };

// FFmpeg colour token → CSS colour: '#rrggbb@a' becomes rgba(); anything else passes through
// (a plain hex, or a named colour whose @opacity we cannot express — the base colour is close enough).
function cssColorFromToken(token: string): string {
  if (!token.includes('@')) return token;

  const [base, alpha] = token.split('@');
  const parsed = Number.parseFloat(alpha);

  if (!base.startsWith('#') || Number.isNaN(parsed)) return base;

  return rgba(base, parsed);
}

/**
 * The CSS properties approximating a TextEffect at `scale` preview px per engine px.
 * Returns {} when the effect is absent or empty (matching the engine's applyTextEffect no-op).
 */
export function textEffectCss(effect: TextEffect | undefined, scale: number): CSSProperties {
  if (!effect) return {};

  const out: CSSProperties = {};

  if (effect.shadow) {
    const shadow = effect.shadow === true ? SHADOW_DEFAULTS : { ...SHADOW_DEFAULTS, ...effect.shadow };
    out.textShadow = `${shadow.dx * scale}px ${shadow.dy * scale}px ${cssColorFromToken(shadow.color)}`;
  }

  if (effect.outline) {
    const outline = effect.outline === true ? OUTLINE_DEFAULTS : { ...OUTLINE_DEFAULTS, ...effect.outline };
    out.WebkitTextStroke = `${outline.width * scale}px ${cssColorFromToken(outline.color)}`;
  }

  return out;
}
