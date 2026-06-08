import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { BaseError } from '@/core/errors/BaseError';
import { FFmpegError } from '@/core/errors/FFmpegError';
import { AssetNotFoundError } from '@/core/errors/AssetNotFoundError';

describe('BaseError', () => {
  it('extends Error and exposes the provided message', () => {
    const err = new BaseError('boom');

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(BaseError);
    expect(err.message).toBe('boom');
  });

  it('sets name to the constructor name', () => {
    const err = new BaseError('boom');

    expect(err.name).toBe('BaseError');
  });

  it('preserves the prototype chain for subclasses (instanceof works)', () => {
    class CustomError extends BaseError {}

    const err = new CustomError('custom');

    expect(err).toBeInstanceOf(CustomError);
    expect(err).toBeInstanceOf(BaseError);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('CustomError');
  });

  it('is throwable and catchable as Error', () => {
    expect(() => {
      throw new BaseError('thrown');
    }).toThrow('thrown');
  });
});

describe('FFmpegError', () => {
  it('extends BaseError', () => {
    const err = new FFmpegError('failed');

    expect(err).toBeInstanceOf(BaseError);
    expect(err).toBeInstanceOf(FFmpegError);
    expect(err.name).toBe('FFmpegError');
  });

  it('keeps the message unchanged when no stderr is provided', () => {
    const err = new FFmpegError('encode failed');

    expect(err.message).toBe('encode failed');
    expect(err.stderr).toBeUndefined();
  });

  it('appends the stderr block to the message when stderr is provided', () => {
    const err = new FFmpegError('encode failed', 'Invalid data found');

    expect(err.stderr).toBe('Invalid data found');
    expect(err.message).toBe('encode failed\n--- FFmpeg stderr ---\nInvalid data found');
  });

  it('treats an empty stderr string as falsy and does not append the block', () => {
    const err = new FFmpegError('encode failed', '');

    expect(err.message).toBe('encode failed');
    expect(err.stderr).toBe('');
  });
});

describe('AssetNotFoundError', () => {
  it('extends BaseError', () => {
    const err = new AssetNotFoundError('logo.png');

    expect(err).toBeInstanceOf(BaseError);
    expect(err).toBeInstanceOf(AssetNotFoundError);
    expect(err.name).toBe('AssetNotFoundError');
  });

  it('formats the message with just the asset name when no search path is given', () => {
    const err = new AssetNotFoundError('logo.png');

    expect(err.message).toBe('Asset not found: logo.png');
  });

  it('includes the search path in the message when provided', () => {
    const err = new AssetNotFoundError('logo.png', '/assets/images');

    expect(err.message).toBe('Asset not found: logo.png (Searched in: /assets/images)');
  });

  it('treats an empty search path as falsy and omits the suffix', () => {
    const err = new AssetNotFoundError('logo.png', '');

    expect(err.message).toBe('Asset not found: logo.png');
  });
});
