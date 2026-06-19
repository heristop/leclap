import { describe, it, expect } from 'vitest';
import { compilePhase } from './compileState';

describe('compilePhase', () => {
  it('is error when an error is present', () => {
    expect(compilePhase({ isProcessing: true, percentage: 40, error: 'boom' })).toBe('error');
  });
  it('is preparing before progress ticks', () => {
    expect(compilePhase({ isProcessing: true, percentage: 0, error: null })).toBe('preparing');
  });
  it('is rendering once progress moves', () => {
    expect(compilePhase({ isProcessing: true, percentage: 1, error: null })).toBe('rendering');
  });
  it('is complete at 100', () => {
    expect(compilePhase({ isProcessing: false, percentage: 100, error: null })).toBe('complete');
  });
});
