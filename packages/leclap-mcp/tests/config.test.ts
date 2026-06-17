import 'reflect-metadata';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const ENV_KEYS = ['LECLAP_MCP_OUTPUT_DIR', 'LECLAP_MCP_MEDIA_DIR', 'LECLAP_MCP_RENDER_TIMEOUT_MS'] as const;

describe('loadConfig', () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = {};
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = saved[key];
      if (value === undefined) {
        delete process.env[key];
        continue;
      }
      process.env[key] = value;
    }
  });

  it('falls back to defaults when nothing is provided', () => {
    const config = loadConfig([]);

    expect(config.outputDir).toBe(path.join(os.homedir(), '.leclap', 'renders'));
    expect(config.mediaDir).toBe(path.join(os.homedir(), '.leclap', 'media'));
    expect(config.renderTimeoutMs).toBe(600_000);
  });

  it('reads values from env vars', () => {
    process.env.LECLAP_MCP_OUTPUT_DIR = '/tmp/env-out';
    process.env.LECLAP_MCP_MEDIA_DIR = '/tmp/env-media';
    process.env.LECLAP_MCP_RENDER_TIMEOUT_MS = '1234';

    const config = loadConfig([]);

    expect(config.outputDir).toBe('/tmp/env-out');
    expect(config.mediaDir).toBe('/tmp/env-media');
    expect(config.renderTimeoutMs).toBe(1234);
  });

  it('lets CLI flags override env vars', () => {
    process.env.LECLAP_MCP_OUTPUT_DIR = '/tmp/env-out';
    process.env.LECLAP_MCP_MEDIA_DIR = '/tmp/env-media';
    process.env.LECLAP_MCP_RENDER_TIMEOUT_MS = '1234';

    const config = loadConfig([
      '--output-dir',
      '/tmp/flag-out',
      '--media-dir=/tmp/flag-media',
      '--render-timeout-ms',
      '5000',
    ]);

    expect(config.outputDir).toBe('/tmp/flag-out');
    expect(config.mediaDir).toBe('/tmp/flag-media');
    expect(config.renderTimeoutMs).toBe(5000);
  });

  it('falls back to the default timeout on NaN or non-positive values', () => {
    expect(loadConfig(['--render-timeout-ms', 'not-a-number']).renderTimeoutMs).toBe(600_000);
    expect(loadConfig(['--render-timeout-ms', '0']).renderTimeoutMs).toBe(600_000);
    expect(loadConfig(['--render-timeout-ms', '-10']).renderTimeoutMs).toBe(600_000);
  });

  it('resolves relative dirs to absolute paths', () => {
    const config = loadConfig(['--output-dir', 'relative/out', '--media-dir', 'relative/media']);

    expect(config.outputDir).toBe(path.resolve('relative/out'));
    expect(config.mediaDir).toBe(path.resolve('relative/media'));
    expect(path.isAbsolute(config.outputDir)).toBe(true);
    expect(path.isAbsolute(config.mediaDir)).toBe(true);
  });
});
