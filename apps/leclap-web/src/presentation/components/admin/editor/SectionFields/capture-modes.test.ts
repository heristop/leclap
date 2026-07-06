import { describe, it, expect } from 'vitest';
import type { TFunction } from 'i18next';
import { allowedSetFrom, effectiveModeFrom, toggleAllowedMode, pickDefaultMode } from './capture-modes';
import { captureSummary } from '../sectionHints';

const t = ((key: string, options?: { count?: number }) => {
  if (key === 'capture.summaryModes') return `${options?.count} modes`;

  return key;
}) as TFunction<'admin'>;

describe('allowedSetFrom', () => {
  it('defaults to all four modes when unset or empty', () => {
    expect(allowedSetFrom(undefined)).toEqual(['front', 'back', 'screen', 'upload']);
    expect(allowedSetFrom([])).toEqual(['front', 'back', 'screen', 'upload']);
  });

  it('passes a restricted set through', () => {
    expect(allowedSetFrom(['back', 'upload'])).toEqual(['back', 'upload']);
  });
});

describe('effectiveModeFrom', () => {
  it('falls back to front when nothing is set', () => {
    expect(effectiveModeFrom({})).toBe('front');
  });

  it('returns the stored mode when allowed', () => {
    expect(effectiveModeFrom({ captureMode: 'screen' })).toBe('screen');
  });

  it('falls back to the first allowed mode when front is not allowed', () => {
    expect(effectiveModeFrom({ allowedCaptureModes: ['screen', 'upload'] })).toBe('screen');
  });

  it('ignores a stored mode outside the allowed set', () => {
    expect(effectiveModeFrom({ captureMode: 'back', allowedCaptureModes: ['front', 'upload'] })).toBe('front');
  });
});

describe('toggleAllowedMode', () => {
  it('removing a mode restricts the set in canonical order', () => {
    expect(toggleAllowedMode({}, 'screen').allowedCaptureModes).toEqual(['front', 'back', 'upload']);
  });

  it('re-adding the last missing mode clears the restriction', () => {
    const next = toggleAllowedMode({ allowedCaptureModes: ['front', 'back', 'upload'] }, 'screen');
    expect(next.allowedCaptureModes).toBeUndefined();
  });

  it('never empties the set: the last remaining mode cannot be toggled off', () => {
    const next = toggleAllowedMode({ allowedCaptureModes: ['upload'], captureMode: 'upload' }, 'upload');
    expect(next).toEqual({ captureMode: 'upload', allowedCaptureModes: ['upload'] });
  });

  it('drops a default mode that is no longer allowed', () => {
    const next = toggleAllowedMode({ captureMode: 'back', allowedCaptureModes: ['front', 'back'] }, 'back');
    // front stays allowed, so the recorder default (front) needs no explicit captureMode.
    expect(next).toEqual({ captureMode: undefined, allowedCaptureModes: ['front'] });
  });

  it('pins an explicit default when front gets excluded', () => {
    const next = toggleAllowedMode({ allowedCaptureModes: ['front', 'screen'] }, 'front');
    expect(next).toEqual({ captureMode: 'screen', allowedCaptureModes: ['screen'] });
  });
});

describe('pickDefaultMode', () => {
  it('stores an explicit non-front default', () => {
    expect(pickDefaultMode({}, 'back')).toEqual({ captureMode: 'back', allowedCaptureModes: undefined });
  });

  it('clears the field when the author picks front (the engine default)', () => {
    expect(pickDefaultMode({ captureMode: 'back' }, 'front')).toEqual({
      captureMode: undefined,
      allowedCaptureModes: undefined,
    });
  });

  it('keeps the allowed restriction untouched', () => {
    const next = pickDefaultMode({ allowedCaptureModes: ['back', 'upload'] }, 'upload');
    expect(next).toEqual({ captureMode: 'upload', allowedCaptureModes: ['back', 'upload'] });
  });
});

describe('captureSummary', () => {
  it('reads Default when nothing is customized', () => {
    expect(captureSummary(t, undefined, undefined)).toBe('summaryChip.default');
  });

  it('names the default mode when set', () => {
    expect(captureSummary(t, 'screen', undefined)).toBe('capture.mode.screen');
  });

  it('counts a restricted allowed set', () => {
    expect(captureSummary(t, undefined, ['front', 'upload'])).toBe('2 modes');
  });

  it('joins mode and restriction', () => {
    expect(captureSummary(t, 'upload', ['back', 'upload'])).toBe('capture.mode.upload · 2 modes');
  });
});
