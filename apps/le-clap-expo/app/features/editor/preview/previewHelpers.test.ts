import {
  FULL_CROP,
  buildErrorMessage,
  computeVideoRect,
  isCropApplied,
  isTrimApplied,
} from './previewHelpers';

describe('buildErrorMessage', () => {
  it('surfaces an Error message from projectError', () => {
    expect(buildErrorMessage(new Error('boom'), 'p1', undefined, null)).toBe('boom');
  });

  it('falls back to a generic message for non-Error project errors', () => {
    expect(buildErrorMessage('weird', 'p1', undefined, null)).toBe('Failed to load project');
  });

  it('reports missing inputs when neither projectId nor videoUri is given', () => {
    expect(buildErrorMessage(null, undefined, undefined, null)).toBe('No project ID or video URI provided');
  });

  it('reports project-not-found when a projectId is given but no project resolves', () => {
    expect(buildErrorMessage(null, 'p1', undefined, null)).toBe('Project not found');
  });

  it('returns null when there is a usable project', () => {
    expect(buildErrorMessage(null, 'p1', undefined, { id: 'p1', templateName: 't' })).toBeNull();
  });

  it('returns null for a bare videoUri preview (no project needed)', () => {
    expect(buildErrorMessage(null, undefined, 'file:///clip.mp4', null)).toBeNull();
  });
});

describe('computeVideoRect', () => {
  it('letterboxes a landscape source in a portrait container (bars top/bottom)', () => {
    const rect = computeVideoRect({ width: 400, height: 800 }, 1920, 1080);

    expect(rect.left).toBe(0);
    expect(rect.width).toBe(400);
    expect(rect.height).toBeCloseTo(225); // 400 / (16/9)
    expect(rect.top).toBeCloseTo((800 - 225) / 2);
  });

  it('pillarboxes a portrait source in a landscape container (bars left/right)', () => {
    const rect = computeVideoRect({ width: 800, height: 400 }, 1080, 1920);

    expect(rect.top).toBe(0);
    expect(rect.height).toBe(400);
    expect(rect.width).toBeCloseTo(225); // 400 * (9/16)
    expect(rect.left).toBeCloseTo((800 - 225) / 2);
  });

  it('fills the container when aspect ratios match', () => {
    const rect = computeVideoRect({ width: 1600, height: 900 }, 1920, 1080);

    expect(rect).toEqual({ left: 0, top: 0, width: 1600, height: 900 });
  });

  it('returns the full container when sizes are unknown', () => {
    expect(computeVideoRect({ width: 0, height: 0 }, 1920, 1080)).toEqual({ left: 0, top: 0, width: 0, height: 0 });
    expect(computeVideoRect({ width: 100, height: 100 }, 0, 0)).toEqual({ left: 0, top: 0, width: 100, height: 100 });
  });
});

describe('isCropApplied', () => {
  it('is false for the full frame', () => {
    expect(isCropApplied(FULL_CROP)).toBe(false);
  });

  it('is true once the frame is moved or shrunk', () => {
    expect(isCropApplied({ x: 0.1, y: 0, w: 1, h: 1 })).toBe(true);
    expect(isCropApplied({ x: 0, y: 0, w: 0.5, h: 1 })).toBe(true);
    expect(isCropApplied({ x: 0, y: 0, w: 1, h: 0.5 })).toBe(true);
  });
});

describe('isTrimApplied', () => {
  it('is false for the full clip range', () => {
    expect(isTrimApplied({ start: 0, end: 10 }, 10)).toBe(false);
  });

  it('is true when the start is moved in', () => {
    expect(isTrimApplied({ start: 2, end: 10 }, 10)).toBe(true);
  });

  it('is true when the end is pulled before the duration', () => {
    expect(isTrimApplied({ start: 0, end: 7 }, 10)).toBe(true);
  });

  it('ignores tiny epsilon-level differences', () => {
    expect(isTrimApplied({ start: 0.01, end: 9.99 }, 10)).toBe(false);
  });
});

describe('FULL_CROP', () => {
  it('represents the entire frame', () => {
    expect(FULL_CROP).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });
});
