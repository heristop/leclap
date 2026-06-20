import { describe, it, expect } from 'vitest';
import {
  resolveOverlayRect,
  moveOverlay,
  resizeOverlay,
  nudgeOverlay,
  rotateOverlay,
  MIN_OVERLAY_SIZE,
} from './imageAnimationDrag';

describe('resolveOverlayRect', () => {
  it('resolves a known position/scale into a frame-px rect', () => {
    const rect = resolveOverlayRect('100:50', '400:200', { w: 800, h: 400 }, 'landscape');

    expect(rect).toEqual({ left: 100, top: 50, width: 400, height: 200 });
  });

  it('falls back to the natural size when position/scale are unset', () => {
    const rect = resolveOverlayRect(undefined, undefined, { w: 320, h: 240 }, 'landscape');

    expect(rect).toEqual({ left: 0, top: 0, width: 320, height: 240 });
  });

  it('derives a -1 scale axis from the other axis preserving aspect', () => {
    // natural 800x400 (2:1). width 400 → height 200.
    const rect = resolveOverlayRect('0:0', '400:-1', { w: 800, h: 400 }, 'landscape');

    expect(rect.width).toBe(400);
    expect(rect.height).toBe(200);
  });

  it('derives a -1 width axis from the height preserving aspect', () => {
    const rect = resolveOverlayRect('0:0', '-1:200', { w: 800, h: 400 }, 'landscape');

    expect(rect.width).toBe(400);
    expect(rect.height).toBe(200);
  });
});

describe('moveOverlay', () => {
  it('shifts the box by the pointer delta in frame px', () => {
    // landscape frame 1280x720; box 200x100 at 100:100, dragged +50/+30.
    const patch = moveOverlay({
      baseX: 100,
      baseY: 100,
      deltaX: 50,
      deltaY: 30,
      width: 200,
      height: 100,
      orientation: 'landscape',
    });

    expect(patch).toEqual({ position: '150:130' });
  });

  it('clamps so the box centre stays within the frame bounds', () => {
    // landscape 1280x720; box 200x100. Dragging far positive clamps to frame.w - w/2 = 1280 - 100.
    const patch = moveOverlay({
      baseX: 0,
      baseY: 0,
      deltaX: 100000,
      deltaY: 100000,
      width: 200,
      height: 100,
      orientation: 'landscape',
    });

    expect(patch).toEqual({ position: `${1280 - 100}:${720 - 50}` });
  });

  it('clamps the lower bound to -w/2 / -h/2', () => {
    const patch = moveOverlay({
      baseX: 0,
      baseY: 0,
      deltaX: -100000,
      deltaY: -100000,
      width: 200,
      height: 100,
      orientation: 'landscape',
    });

    expect(patch).toEqual({ position: '-100:-50' });
  });
});

describe('resizeOverlay', () => {
  it('writes a clamped "w:h" string', () => {
    const patch = resizeOverlay({
      baseW: 200,
      baseH: 100,
      deltaX: 50,
      deltaY: 25,
      orientation: 'landscape',
    });

    expect(patch).toEqual({ scale: '250:125' });
  });

  it('clamps to the minimum size', () => {
    const patch = resizeOverlay({
      baseW: 200,
      baseH: 100,
      deltaX: -100000,
      deltaY: -100000,
      orientation: 'landscape',
    });

    expect(patch).toEqual({ scale: `${MIN_OVERLAY_SIZE}:${MIN_OVERLAY_SIZE}` });
  });
});

describe('nudgeOverlay', () => {
  it('shifts position by the step within bounds', () => {
    const patch = nudgeOverlay({
      position: '100:100',
      scale: '200:100',
      natural: { w: 200, h: 100 },
      orientation: 'landscape',
      dx: 8,
      dy: -8,
    });

    expect(patch).toEqual({ position: '108:92' });
  });
});

describe('rotateOverlay', () => {
  it('returns degrees clockwise from the box centre to the pointer', () => {
    // pointer directly to the right of centre → +90deg (0 = up).
    const patch = rotateOverlay({ centerX: 100, centerY: 100, clientX: 200, clientY: 100, snap: false });

    expect(patch).toEqual({ rotation: 90 });
  });

  it('snaps to 15deg increments when requested', () => {
    const patch = rotateOverlay({ centerX: 100, centerY: 100, clientX: 200, clientY: 110, snap: true });

    expect(patch.rotation % 15).toBe(0);
  });
});
