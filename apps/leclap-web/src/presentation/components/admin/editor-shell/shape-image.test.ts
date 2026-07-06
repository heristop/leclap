// Pure geometry/factory tests for the shape-element helper. The canvas rasterizer itself needs a
// real 2D context (browser); in this node environment `renderShapePng` falls back to a transparent
// placeholder, which the factory tests assert so a broken canvas can never emit an invalid choice.
import { describe, it, expect } from 'vitest';
import {
  defaultShapeBox,
  defaultShapeSpec,
  newShapeImage,
  regeneratedShapePatch,
  renderShapePng,
  shapeDrawPlan,
  shapeTargetBox,
  SHAPE_RASTER_SCALE,
} from './shape-image';

describe('shapeDrawPlan', () => {
  it('plans a plain rect at 2x the target box with square corners and no stroke', () => {
    const plan = shapeDrawPlan({ kind: 'rect', color: '#ff4d4d' }, { w: 240, h: 120 });

    expect(plan).toEqual({
      width: 480,
      height: 240,
      fill: '#ff4d4d',
      path: { type: 'rect', x: 0, y: 0, w: 480, h: 240, radius: 0 },
    });
  });

  it('scales the corner radius by the raster factor and clamps it to half the short edge', () => {
    const rounded = shapeDrawPlan({ kind: 'rect', color: '#000000', cornerRadius: 24 }, { w: 240, h: 120 });
    expect(rounded.path).toMatchObject({ radius: 24 * SHAPE_RASTER_SCALE });

    const clamped = shapeDrawPlan({ kind: 'rect', color: '#000000', cornerRadius: 999 }, { w: 240, h: 120 });
    expect(clamped.path).toMatchObject({ radius: 120 });
  });

  it('insets the path by half the stroke width so the outline stays inside the box', () => {
    const plan = shapeDrawPlan(
      { kind: 'rect', color: '#000000', strokeWidth: 8, strokeColor: '#ffffff' },
      { w: 100, h: 100 }
    );

    expect(plan.path).toEqual({ type: 'rect', x: 8, y: 8, w: 184, h: 184, radius: 0 });
    expect(plan.stroke).toEqual({ color: '#ffffff', width: 16 });
  });

  it('ignores a zero stroke width and defaults a missing stroke colour to white', () => {
    const none = shapeDrawPlan({ kind: 'rect', color: '#000000', strokeWidth: 0 }, { w: 100, h: 100 });
    expect(none.stroke).toBeUndefined();

    const defaulted = shapeDrawPlan({ kind: 'rect', color: '#000000', strokeWidth: 2 }, { w: 100, h: 100 });
    expect(defaulted.stroke).toEqual({ color: '#ffffff', width: 4 });
  });

  it('plans a centred ellipse with radii inset by half the stroke width', () => {
    const plan = shapeDrawPlan(
      { kind: 'ellipse', color: '#7c83fd', strokeWidth: 4, strokeColor: '#101014' },
      { w: 200, h: 100 }
    );

    expect(plan.path).toEqual({ type: 'ellipse', cx: 200, cy: 100, rx: 196, ry: 96 });
    expect(plan.stroke).toEqual({ color: '#101014', width: 8 });
  });

  it('ignores cornerRadius on an ellipse', () => {
    const plan = shapeDrawPlan({ kind: 'ellipse', color: '#7c83fd', cornerRadius: 40 }, { w: 100, h: 100 });

    expect(plan.path).toEqual({ type: 'ellipse', cx: 100, cy: 100, rx: 100, ry: 100 });
  });
});

describe('shapeTargetBox', () => {
  it('parses the overlay "w:h" scale box', () => {
    expect(shapeTargetBox('300:180', 'portrait')).toEqual({ w: 300, h: 180 });
  });

  it('falls back to the orientation default when the scale is missing or unparseable', () => {
    expect(shapeTargetBox(undefined, 'portrait')).toEqual(defaultShapeBox('portrait'));
    expect(shapeTargetBox('300:-1', 'landscape')).toEqual(defaultShapeBox('landscape'));
    expect(shapeTargetBox('iw/2:ih', 'square')).toEqual(defaultShapeBox('square'));
  });
});

describe('defaultShapeBox', () => {
  it('sizes a square box from a third of the frame short edge', () => {
    expect(defaultShapeBox('portrait')).toEqual({ w: 240, h: 240 });
    expect(defaultShapeBox('landscape')).toEqual({ w: 240, h: 240 });
    expect(defaultShapeBox('square')).toEqual({ w: 360, h: 360 });
  });
});

describe('newShapeImage', () => {
  it('creates a centred image overlay carrying the shape recipe and a data: PNG url', () => {
    const overlay = newShapeImage('rect', 'portrait');

    expect(overlay.shape).toEqual(defaultShapeSpec('rect'));
    expect(overlay.scale).toBe('240:240');
    expect(overlay.position).toBe('240:520'); // (720-240)/2 : (1280-240)/2
    expect(overlay.choice.source).toBe('url');
    expect((overlay.choice as { url: string }).url.startsWith('data:image/png')).toBe(true);
    expect(overlay.id).toBeTruthy();
  });

  it('creates an ellipse recipe for the circle menu entry', () => {
    expect(newShapeImage('ellipse', 'landscape').shape?.kind).toBe('ellipse');
  });
});

describe('regeneratedShapePatch', () => {
  it('re-rasterizes the PNG at the overlay current scale box alongside the new recipe', () => {
    const overlay = newShapeImage('rect', 'portrait');
    const next = { ...defaultShapeSpec('rect'), color: '#101014' };
    const patch = regeneratedShapePatch({ ...overlay, scale: '120:60' }, next, 'portrait');

    expect(patch.shape).toEqual(next);
    expect(patch.choice).toEqual({ source: 'url', url: renderShapePng(next, { w: 120, h: 60 }) });
  });
});
