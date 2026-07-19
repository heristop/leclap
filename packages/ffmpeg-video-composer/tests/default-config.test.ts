import { describe, it, expect } from 'vitest';
import DefaultConfig from '@/core/default.config';

describe('DefaultConfig', () => {
  it('exposes the output fps default', () => {
    expect(DefaultConfig.FPS).toBe(30);
  });
});
