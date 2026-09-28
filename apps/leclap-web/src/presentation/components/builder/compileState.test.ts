import { describe, it, expect } from 'vitest';
import { compilePhase } from './compileState';

describe('compilePhase', () => {
  it('is error once the render failed', () => {
    expect(compilePhase({ isProcessing: true, percentage: 40, failed: true })).toBe('error');
  });
  it('is preparing before progress ticks', () => {
    expect(compilePhase({ isProcessing: true, percentage: 0, failed: false })).toBe('preparing');
  });
  it('is rendering once progress moves', () => {
    expect(compilePhase({ isProcessing: true, percentage: 1, failed: false })).toBe('rendering');
  });
  it('is complete at 100', () => {
    expect(compilePhase({ isProcessing: false, percentage: 100, failed: false })).toBe('complete');
  });
});
