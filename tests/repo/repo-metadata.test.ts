import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const metadata = JSON.parse(readFileSync(join(repoRoot, '.github/repo-metadata.json'), 'utf8'));

// GitHub's documented ceilings. Exceeding any of them makes `gh api` reject the whole PATCH, so
// catching it here turns a failed deploy into a failed test.
describe('repo metadata manifest', () => {
  it('has a description within GitHub 350-char ceiling', () => {
    expect(metadata.description.length).toBeGreaterThan(0);
    expect(metadata.description.length).toBeLessThanOrEqual(350);
  });

  it('names the two differentiators that the old description omitted', () => {
    expect(metadata.description).toMatch(/on-device/i);
    expect(metadata.description).toMatch(/\bMCP\b|agent/i);
  });

  it('spells the brand as LeClap wherever it appears', () => {
    expect(metadata.description).not.toMatch(/\bLeclap\b|\bleClap\b|\bLECLAP\b/);
  });

  it('points homepage at the docs site', () => {
    expect(metadata.homepage).toBe('https://leclap.dev');
  });

  it('carries at most 20 topics, each in GitHub required format', () => {
    expect(metadata.topics.length).toBeLessThanOrEqual(20);
    expect(metadata.topics.length).toBeGreaterThanOrEqual(10);
    for (const topic of metadata.topics) {
      expect(topic, `topic "${topic}"`).toMatch(/^[a-z0-9][a-z0-9-]{0,49}$/);
    }
  });

  it('covers the agent and on-device surfaces that GitHub search users type', () => {
    for (const required of ['mcp', 'model-context-protocol', 'on-device', 'ffmpeg', 'react-native']) {
      expect(metadata.topics).toContain(required);
    }
  });

  it('has no duplicate topics', () => {
    expect(new Set(metadata.topics).size).toBe(metadata.topics.length);
  });
});
