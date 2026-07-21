import 'reflect-metadata';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const ENV_KEYS = [
  'LECLAP_MCP_OUTPUT_DIR',
  'LECLAP_MCP_MEDIA_DIR',
  'LECLAP_MCP_RENDER_TIMEOUT_MS',
  'LECLAP_MCP_ALLOW_REMOTION',
] as const;

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
    expect(config.allowRemotion).toBe(false);
  });

  it('enables Remotion only when explicitly opted in', () => {
    expect(loadConfig([]).allowRemotion).toBe(false);
    expect(loadConfig(['--allow-remotion']).allowRemotion).toBe(true);
    expect(loadConfig(['--allow-remotion=true']).allowRemotion).toBe(true);
    expect(loadConfig(['--allow-remotion=false']).allowRemotion).toBe(false);

    process.env.LECLAP_MCP_ALLOW_REMOTION = '1';
    expect(loadConfig([]).allowRemotion).toBe(true);
  });

  it('does not let a bare --allow-remotion swallow the following argument', () => {
    const config = loadConfig(['--allow-remotion', '--media-dir', '/tmp/flag-media']);

    expect(config.allowRemotion).toBe(true);
    expect(config.mediaDir).toBe('/tmp/flag-media');
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
