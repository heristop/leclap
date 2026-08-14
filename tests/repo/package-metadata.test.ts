import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

// The three packages that reach npm. The rest of the workspace is private and exempt.
const PUBLISHED = ['packages/ffmpeg-video-composer', 'packages/leclap-cli', 'packages/leclap-mcp'];

const readPkg = (dir: string) => JSON.parse(readFileSync(join(repoRoot, dir, 'package.json'), 'utf8'));

describe.each(PUBLISHED)('%s', (dir) => {
  const pkg = readPkg(dir);

  // Each of these renders as a distinct element on the npm package page. A missing one is a
  // missing link, and npm gives no warning about it.
  it('carries every field npm renders on the package page', () => {
    expect(pkg.description, 'description').toBeTruthy();
    expect(pkg.license, 'license').toBe('MIT');
    expect(pkg.homepage, 'homepage').toBe('https://leclap.dev');
    expect(pkg.repository?.url, 'repository.url').toBe('git+https://github.com/heristop/leclap.git');
    expect(pkg.repository?.directory, 'repository.directory').toBe(dir);
  });

  it('carries enough keywords to be found by search', () => {
    expect(pkg.keywords?.length ?? 0).toBeGreaterThanOrEqual(5);
  });

  it('spells the brand LeClap in its description', () => {
    expect(pkg.description).not.toMatch(/\bLeclap\b|\bleClap\b/);
  });

  it('pins the same typescript major as the workspace root', () => {
    const rootTs = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')).devDependencies.typescript;
    const ownTs = pkg.devDependencies?.typescript;
    if (ownTs === undefined) return;
    expect(ownTs.replace(/^\^|~/, '').split('.')[0]).toBe(rootTs.replace(/^\^|~/, '').split('.')[0]);
  });
});

describe('@leclap/mcp discoverability', () => {
  it('claims the keywords an agent developer would search', () => {
    const pkg = readPkg('packages/leclap-mcp');
    for (const required of ['mcp', 'model-context-protocol', 'ai-agent']) {
      expect(pkg.keywords).toContain(required);
    }
  });
});
