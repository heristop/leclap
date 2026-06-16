import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { resolveLogLevel } from '../src/platform/logging/PinoLogAdapter';

describe('resolveLogLevel', () => {
  it('defaults to "info" when LECLAP_LOG_LEVEL is unset', () => {
    expect(resolveLogLevel({})).toBe('info');
  });

  it('honors LECLAP_LOG_LEVEL', () => {
    expect(resolveLogLevel({ LECLAP_LOG_LEVEL: 'silent' })).toBe('silent');
    expect(resolveLogLevel({ LECLAP_LOG_LEVEL: 'debug' })).toBe('debug');
  });

  it('falls back to "info" for an empty value', () => {
    expect(resolveLogLevel({ LECLAP_LOG_LEVEL: '' })).toBe('info');
  });
});
