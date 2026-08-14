import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const html = readFileSync(join(repoRoot, 'apps/leclap-web/index.html'), 'utf8');
const llmsTxt = readFileSync(join(repoRoot, 'apps/leclap-web/public/llms.txt'), 'utf8');

const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(([, json]) =>
  JSON.parse(json)
);

describe('structured data', () => {
  it('declares both the app and the source project', () => {
    const types = blocks.map((b) => b['@type']);
    expect(types).toContain('WebApplication');
    expect(types).toContain('SoftwareSourceCode');
  });

  it('every block is valid JSON with a schema.org context', () => {
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block['@context']).toBe('https://schema.org');
    }
  });

  // The one-line pitch must be identical wherever a machine reads it, or an LLM summarising the
  // project gets three different answers depending on which surface it crawled.
  it('reuses the canonical description from the repo metadata manifest', () => {
    const canonical = JSON.parse(readFileSync(join(repoRoot, '.github/repo-metadata.json'), 'utf8')).description;
    const source = blocks.find((b) => b['@type'] === 'SoftwareSourceCode');
    expect(source.description).toBe(canonical);
  });

  it('names the runtimes and the license on the source block', () => {
    const source = blocks.find((b) => b['@type'] === 'SoftwareSourceCode');
    expect(source.programmingLanguage).toContain('TypeScript');
    expect(source.license).toBe('https://opensource.org/licenses/MIT');
    expect(source.codeRepository).toBe('https://github.com/heristop/leclap');
  });
});

describe('llms.txt', () => {
  // The engine does not produce identical bytes on every target: Node and the browser take the
  // libx264 software path, Android encodes with libopenh264, iOS with h264_videotoolbox, and the
  // LGPL on-device build drops boxblur / rewrites eq to lutyuv. An LLM repeats whatever this file
  // claims, so the claim has to be the one README stands behind: reproducible *per platform*.
  it('does not claim identical output across platforms', () => {
    const overclaims = [/\bidentical(ly)?\b/i, /same\s+(?:\w+\s+){0,3}output\s+everywhere/i];
    for (const pattern of overclaims) {
      expect(llmsTxt, `llms.txt overclaims cross-platform determinism: ${pattern}`).not.toMatch(pattern);
    }
  });

  it('scopes reproducibility to a platform', () => {
    expect(llmsTxt).toMatch(/reproducible per platform/i);
  });

  it('says what to use LeClap instead of, and how to wire it to an agent', () => {
    expect(llmsTxt).toContain('## When to choose LeClap');
    expect(llmsTxt).toContain('## Use it from an AI agent');
    expect(llmsTxt).toContain('@leclap/mcp');
    for (const tool of ['get_schema', 'validate_template', 'compose_video', 'probe_media']) {
      expect(llmsTxt, `MCP tool ${tool} not listed`).toContain(tool);
    }
  });

  it('spells the brand LeClap everywhere', () => {
    expect(llmsTxt).not.toMatch(/\bLeclap\b|\bleClap\b|\bLECLAP\b/);
  });
});
