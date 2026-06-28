import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { resolveAssetsDir } from '../src/resolveAssetsDir';

describe('resolveAssetsDir', () => {
  it('resolves the caller cwd/assets', () => {
    const cwd = '/work/project';

    expect(resolveAssetsDir(cwd)).toBe(path.resolve(cwd, 'assets'));
  });

  it('does not reach into any sibling workspace package (no creative-kit)', () => {
    expect(resolveAssetsDir('/repo/packages/leclap-cli')).not.toContain('leclap-creative-kit');
  });
});
