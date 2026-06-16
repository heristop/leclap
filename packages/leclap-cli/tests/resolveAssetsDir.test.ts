import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { resolveAssetsDir } from '../src/resolveAssetsDir';

describe('resolveAssetsDir', () => {
  const cwd = '/work/project';
  const moduleDir = '/repo/packages/leclap-cli/dist';
  const localAssets = path.resolve(cwd, 'assets');
  const demo = path.resolve(moduleDir, '../../leclap-creative-kit/src/library');

  it('prefers the caller cwd/assets when it exists', () => {
    expect(resolveAssetsDir(cwd, moduleDir, (p) => p === localAssets)).toBe(localAssets);
  });

  it('falls back to the bundled creative-kit demo assets when cwd/assets is absent', () => {
    expect(resolveAssetsDir(cwd, moduleDir, (p) => p === demo)).toBe(demo);
  });

  it('returns cwd/assets when neither exists', () => {
    expect(resolveAssetsDir(cwd, moduleDir, () => false)).toBe(localAssets);
  });
});
