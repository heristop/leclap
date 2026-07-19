import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { renderCapabilityMatrix } from '../scripts/capability-sources';

const here = path.dirname(fileURLToPath(import.meta.url));
const docPath = path.resolve(here, '../../../docs/runtime-capabilities.md');

describe('runtime capability matrix', () => {
  it('docs/runtime-capabilities.md is up to date (run pnpm --filter ffmpeg-video-composer generate:capabilities)', () => {
    expect(fs.existsSync(docPath), 'doc missing — run generate:capabilities').toBe(true);
    expect(fs.readFileSync(docPath, 'utf8')).toBe(renderCapabilityMatrix());
  });

  // The freshness test alone would stay green if compatRuleFor probed with a real device set (every
  // gap would then mislabel as covered by the drop rule); pin the semantic content of the column.
  it('the compat column reflects rewrite rules, never the drop rule', () => {
    const rendered = renderCapabilityMatrix();
    expect(rendered).toContain('via compat: eq-to-lutyuv');
    expect(rendered).not.toContain('drop-absent-on-device');
  });
});
