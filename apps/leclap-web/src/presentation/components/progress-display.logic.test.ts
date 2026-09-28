import { describe, it, expect } from 'vitest';
import { RENDER_QUIPS } from '@leclap/creative-kit/render-quips';
import { QUIP_KEYS, etaVisible, formatDuration, quipKey, remainingMs, stageKey } from './progress-display.logic';

describe('formatDuration', () => {
  it('reads seconds, then minutes and seconds, with the locale’s own units', () => {
    expect(formatDuration(12_400, 'en')).toBe('12s');
    expect(formatDuration(65_000, 'en')).toBe('1m 5s');
    expect(formatDuration(65_000, 'de')).toBe('1 Min. 5 Sek.');
  });

  it('never goes negative', () => {
    expect(formatDuration(-800, 'en')).toBe('0s');
  });
});

describe('stageKey', () => {
  it('names each engine stage in the viewer’s language', () => {
    expect(stageKey('Initializing')).toBe('progress.stage.initializing');
    expect(stageKey('Compiling')).toBe('progress.stage.compiling');
    expect(stageKey('Error')).toBe('progress.stage.error');
  });

  it('falls back to the generic headline for a stage it does not know', () => {
    expect(stageKey('Reticulating')).toBe('progress.header.title');
    expect(stageKey('')).toBe('progress.header.title');
  });
});

describe('quipKey', () => {
  it('walks the same journey as the creative kit’s quips', () => {
    expect(QUIP_KEYS).toHaveLength(RENDER_QUIPS.length);
  });

  it('opens on the first line and ends on the last', () => {
    expect(quipKey(0)).toBe(QUIP_KEYS[0]);
    expect(quipKey(100)).toBe(QUIP_KEYS.at(-1));
  });

  it('holds a line within its band, then advances as the bar climbs', () => {
    expect(quipKey(1)).toBe(quipKey(6));
    expect(quipKey(50)).not.toBe(quipKey(10));
  });

  it('clamps out-of-range progress', () => {
    expect(quipKey(-20)).toBe(QUIP_KEYS[0]);
    expect(quipKey(180)).toBe(QUIP_KEYS.at(-1));
  });
});

describe('remainingMs', () => {
  it('prefers the estimate the progress source already made', () => {
    expect(remainingMs(8_000, 40, 5_000)).toBe(5_000);
  });

  it('extrapolates from its own clock when the source gives none', () => {
    // 40% in 8s → 12s to go at the same pace.
    expect(remainingMs(8_000, 40, undefined)).toBe(12_000);
  });

  it('has nothing to extrapolate from before any progress', () => {
    expect(remainingMs(3_000, 0, undefined)).toBeUndefined();
  });
});

describe('etaVisible', () => {
  it('hides the estimate while it is still noise', () => {
    // 14% after one second extrapolates to "~0s remaining".
    expect(etaVisible(1_000, 14, 400)).toBe(false);
    expect(etaVisible(6_000, 2, 40_000)).toBe(false);
  });

  it('shows it once the render has time and progress behind it', () => {
    expect(etaVisible(6_000, 40, 9_000)).toBe(true);
  });

  it('drops it when there is nothing meaningful left to wait for', () => {
    expect(etaVisible(12_000, 100, 0)).toBe(false);
    expect(etaVisible(12_000, 99, 600)).toBe(false);
    expect(etaVisible(12_000, 60, undefined)).toBe(false);
  });
});
