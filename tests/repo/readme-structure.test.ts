import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8');

describe('README structure', () => {
  // A reader decides in the first screenful. The demo has to beat the prose to it.
  it('shows the demo before the feature table', () => {
    const demo = readme.indexOf('## 🎥 Demo');
    const features = readme.indexOf('| Highlight');
    expect(demo, 'demo section missing').toBeGreaterThan(-1);
    expect(features, 'feature table missing').toBeGreaterThan(-1);
    expect(demo).toBeLessThan(features);
  });

  it('carries a comparison table naming the alternatives people already know', () => {
    const why = readme.indexOf('## 🤔 Why LeClap?');
    expect(why, 'Why LeClap? section missing').toBeGreaterThan(-1);
    const section = readme.slice(why, why + 2000);
    expect(section).toContain('Remotion');
    expect(section).toContain('Shotstack');
  });

  // npm strips GitHub user-attachment videos, so the npm page must still show motion.
  it('embeds at least one image asset that renders outside GitHub', () => {
    expect(readme).toMatch(/!\[[^\]]*\]\(https:\/\/[^)]+\.(gif|png|jpg|webp)\)/);
  });

  it('spells the brand LeClap everywhere', () => {
    expect(readme).not.toMatch(/\bLeclap\b|\bleClap\b|\bLECLAP\b/);
  });
});
