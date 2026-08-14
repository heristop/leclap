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

  // Asserting on the prose is vacuous — the positioning paragraph already name-drops
  // "(Remotion/Shotstack)". Assert on the table itself, so deleting it turns this red.
  it('carries a comparison table naming the alternatives people already know', () => {
    const why = readme.indexOf('## 🤔 Why LeClap?');
    expect(why, 'Why LeClap? section missing').toBeGreaterThan(-1);

    const lines = readme.slice(why).split('\n');
    const headerIndex = lines.findIndex(
      (line) => line.startsWith('|') && line.includes('Remotion') && line.includes('Shotstack')
    );
    expect(headerIndex, 'comparison table header row missing').toBeGreaterThan(-1);

    const columns = lines[headerIndex]
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    expect(columns, 'one column per alternative, plus the criterion column').toHaveLength(5);
    expect(columns.join(' '), 'LeClap needs its own column').toContain('LeClap');

    // a markdown table header is followed by its alignment separator
    expect(lines[headerIndex + 1], 'header row is not a table header').toMatch(/^\|[\s:|-]+\|$/);

    const rows: string[] = [];
    for (const line of lines.slice(headerIndex + 2)) {
      if (!line.startsWith('|')) break;
      rows.push(line);
    }
    expect(rows.length, 'the table has to actually compare something').toBeGreaterThanOrEqual(3);
  });

  // npm strips GitHub user-attachment videos, so the npm page must still show motion.
  it('embeds at least one image asset that renders outside GitHub', () => {
    expect(readme).toMatch(/!\[[^\]]*\]\(https:\/\/[^)]+\.(gif|png|jpg|webp)\)/);
  });

  it('spells the brand LeClap everywhere', () => {
    expect(readme).not.toMatch(/\bLeclap\b|\bleClap\b|\bLECLAP\b/);
  });
});
