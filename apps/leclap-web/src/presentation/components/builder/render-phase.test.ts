import { describe, it, expect } from 'vitest';
import { renderPhase } from './render-phase';

const idle = { hasResult: false, isProcessing: false, failed: false, stopped: false };

describe('renderPhase', () => {
  it('shows the result once a finished video exists', () => {
    expect(renderPhase({ ...idle, hasResult: true })).toBe('result');
  });

  it('keeps the monitor up while the render runs', () => {
    expect(renderPhase({ ...idle, isProcessing: true })).toBe('processing');
  });

  it('keeps a failed render on the monitor, where its way out lives', () => {
    expect(renderPhase({ ...idle, failed: true })).toBe('processing');
  });

  it('returns to editing when nothing is running, failed or finished', () => {
    expect(renderPhase(idle)).toBe('edit');
  });

  it('never resurfaces a stopped render, even when its late result or error lands', () => {
    expect(renderPhase({ ...idle, stopped: true, hasResult: true })).toBe('edit');
    expect(renderPhase({ ...idle, stopped: true, failed: true })).toBe('edit');
  });
});
