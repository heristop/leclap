import { XFADE_TRANSITIONS } from 'ffmpeg-video-composer/src/schemas/effects.schemas.ts';
import {
  transitionGroups,
  transitionLabel,
  percentToExpr,
  exprToPercent,
  newBaseLayer,
  newExtraLayer,
  DEFAULT_EXTRA_GEOMETRY,
} from './editorPrimitives';

describe('transitionGroups', () => {
  const groups = transitionGroups();

  it('puts the Fades catch-all first', () => {
    expect(groups[0].label).toBe('Fades');
  });

  it('covers every XFADE_TRANSITIONS name exactly once', () => {
    const flat = groups.flatMap((g) => g.names);

    expect([...flat].sort()).toEqual([...XFADE_TRANSITIONS].sort());
    expect(flat.length).toBe(new Set(flat).size);
  });

  it('drops empty buckets', () => {
    expect(groups.every((g) => g.names.length > 0)).toBe(true);
  });

  it('buckets by the expected rules', () => {
    const find = (name: string) => groups.find((g) => g.names.includes(name as never))?.label;

    expect(find('wipeleft')).toBe('Wipes');
    expect(find('smoothup')).toBe('Wipes');
    expect(find('slideleft')).toBe('Slides');
    expect(find('squeezeh')).toBe('Slides');
    expect(find('circleopen')).toBe('Circles');
    expect(find('hlslice')).toBe('Slices');
    expect(find('coverleft')).toBe('Covers');
    expect(find('revealup')).toBe('Reveals');
    expect(find('diagbl')).toBe('Reveals');
    expect(find('fade')).toBe('Fades');
  });
});

describe('transitionLabel', () => {
  it('labels a cut', () => {
    expect(transitionLabel('cut', undefined)).toBe('Cut');
  });

  it('capitalises and appends the duration', () => {
    expect(transitionLabel('wipeleft', 0.4)).toBe('Wipeleft · 0.4s');
  });

  it('falls back to 0.5s when no duration', () => {
    expect(transitionLabel('fade', undefined)).toBe('Fade · 0.5s');
  });
});

describe('layer geometry round-trip', () => {
  it('percentToExpr uses iw for x/w and ih for y/h', () => {
    expect(percentToExpr('x', 25)).toBe('iw*0.2500');
    expect(percentToExpr('w', 50)).toBe('iw*0.5000');
    expect(percentToExpr('y', 25)).toBe('ih*0.2500');
    expect(percentToExpr('h', 50)).toBe('ih*0.5000');
  });

  it('exprToPercent recovers the percentage from an expression', () => {
    expect(exprToPercent('iw*0.25', 0)).toBe(25);
    expect(exprToPercent('ih*0.5', 0)).toBe(50);
  });

  it('exprToPercent reads a bare number as a raw percentage', () => {
    expect(exprToPercent(40, 0)).toBe(40);
  });

  it('exprToPercent falls back when undefined or unparseable', () => {
    expect(exprToPercent(undefined, 33)).toBe(33);
    expect(exprToPercent('garbage', 33)).toBe(33);
  });

  it('round-trips percent -> expr -> percent', () => {
    expect(exprToPercent(percentToExpr('x', 25), 0)).toBe(25);
    expect(exprToPercent(percentToExpr('h', 50), 0)).toBe(50);
  });
});

describe('layer factories', () => {
  it('newBaseLayer is a full-bleed solid colour', () => {
    expect(newBaseLayer('#7C83FD')).toEqual({ color: '#7C83FD', opacity: 1 });
  });

  it('newExtraLayer is a centred half-frame translucent box', () => {
    const layer = newExtraLayer();

    expect(layer.opacity).toBe(0.5);
    expect(exprToPercent(layer.x, 0)).toBe(DEFAULT_EXTRA_GEOMETRY.x);
    expect(exprToPercent(layer.w, 0)).toBe(DEFAULT_EXTRA_GEOMETRY.w);
  });
});
