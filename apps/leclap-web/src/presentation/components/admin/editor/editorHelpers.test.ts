import { describe, it, expect } from 'vitest';
import { XFADE_TRANSITIONS } from 'ffmpeg-video-composer/src/schemas/effects.schemas.ts';
import type { TFunction } from 'i18next';
import { transitionGroups, familyFor, transitionLabel } from './transitionGroups';
import { lookFilter, gradeFilter, pruneGrade, GRADE_DEFAULTS } from './lookFilters';
import { percentToExpr, exprToPercent, newExtraLayer, newBaseLayer } from './layerGeometry';
import { cssLayerBackground } from './layerPreview';

const t = ((key: string, options?: { name?: string; duration?: number }) => {
  if (key === 'transition.cut') return 'Cut';
  if (key === 'transition.label') return `${options?.name} · ${options?.duration}s`;

  return key;
}) as TFunction<'admin'>;

describe('transitionGroups', () => {
  it('buckets every xfade name into exactly one non-empty group', () => {
    const groups = transitionGroups();
    const total = groups.reduce((n, g) => n + g.names.length, 0);

    expect(total).toBe(XFADE_TRANSITIONS.length);
    expect(groups.every((g) => g.names.length > 0)).toBe(true);
  });

  it('leads with Fades (the catch-all bucket)', () => {
    expect(transitionGroups()[0].label).toBe('Fades');
  });

  it('maps known prefixes to the right preview family', () => {
    expect(familyFor('fade')).toBe('fade');
    expect(familyFor('wipeleft')).toBe('wipe');
    expect(familyFor('slideup')).toBe('slide');
    expect(familyFor('circleopen')).toBe('circle');
    expect(familyFor('coverleft')).toBe('cover');
    expect(familyFor('revealdown')).toBe('reveal');
    expect(familyFor('hlslice')).toBe('slice');
  });

  it('labels cut and named transitions for the chip', () => {
    expect(transitionLabel('cut', undefined, t)).toBe('Cut');
    expect(transitionLabel('wipeleft', 0.4, t)).toBe('Wipeleft · 0.4s');
  });
});

describe('lookFilter / gradeFilter', () => {
  it('returns none for no look and a real filter for a known preset', () => {
    expect(lookFilter(undefined)).toBe('none');
    expect(lookFilter('noir')).toContain('grayscale');
  });

  it('folds gamma into brightness and includes every channel', () => {
    const filter = gradeFilter({ contrast: 1.5, gamma: 2 });

    expect(filter).toContain('contrast(1.5)');
    expect(filter).toContain('brightness');
    expect(filter).toContain('saturate');
  });

  it('prunes default-valued grade fields and collapses an all-default grade to undefined', () => {
    expect(pruneGrade({ ...GRADE_DEFAULTS })).toBeUndefined();
    expect(pruneGrade({ contrast: 1.4, brightness: 0 })).toEqual({ contrast: 1.4 });
  });
});

describe('layerGeometry', () => {
  it('round-trips percent ↔ expression', () => {
    const expr = percentToExpr('w', 50);

    expect(expr).toBe('iw*0.5000');
    expect(exprToPercent(expr, 0)).toBe(50);
  });

  it('falls back for unparseable / missing geometry', () => {
    expect(exprToPercent(undefined, 25)).toBe(25);
    expect(exprToPercent('garbage', 25)).toBe(25);
    expect(exprToPercent(40, 25)).toBe(40);
  });

  it('base layer is full-bleed; extra layer is inset by its geometry', () => {
    expect(cssLayerBackground(newBaseLayer('#fff'), true).inset).toBe(0);

    const extra = cssLayerBackground(newExtraLayer(), false);

    expect(extra.inset).toBeUndefined();
    expect(extra.width).toBe('50%');
  });

  it('renders a gradient layer as a CSS linear-gradient', () => {
    const style = cssLayerBackground({ gradient: { from: '#000', to: '#fff', direction: 'horizontal' } }, true);

    expect(String(style.background)).toContain('linear-gradient(to right');
  });
});
