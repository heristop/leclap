import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const metadata = JSON.parse(readFileSync(join(repoRoot, '.github/repo-metadata.json'), 'utf8'));

// Every occurrence of the brand in the manifest, whatever its casing, paired with the casing that
// field is required to use. Prose carries the display spelling `LeClap`; the other two fields are
// lowercase not by preference but by format — GitHub rejects a topic that is not lowercase, and the
// homepage is a URL host. Encoding the required casing per field keeps the lowercase `leclap` topic
// legal without weakening the rule for prose.
const BRAND_ANY_CASE = /leclap/gi;
const brandFields: { label: string; values: string[]; requiredCasing: string }[] = [
  { label: 'description', values: [metadata.description], requiredCasing: 'LeClap' },
  { label: 'homepage', values: [metadata.homepage], requiredCasing: 'leclap' },
  { label: 'topics', values: metadata.topics, requiredCasing: 'leclap' },
];

const brandOccurrences = brandFields.flatMap(({ label, values, requiredCasing }) =>
  values.flatMap((value: string) =>
    (value.match(BRAND_ANY_CASE) ?? []).map((spelling) => ({
      label,
      value,
      spelling,
      requiredCasing,
    }))
  )
);

// GitHub's documented ceilings. Exceeding any of them makes `gh api` reject the whole PATCH, so
// catching it here turns a failed deploy into a failed test.
describe('repo metadata manifest', () => {
  it('has a description between a usable floor and GitHub 350-char ceiling', () => {
    // The floor is what separates a pitch from a placeholder: a one-word or headline-length
    // description would sync cleanly and still say nothing, so it has to fail here.
    expect(metadata.description.length).toBeGreaterThanOrEqual(60);
    expect(metadata.description.trim().split(/\s+/).length).toBeGreaterThanOrEqual(10);
    expect(metadata.description.length).toBeLessThanOrEqual(350);
  });

  it('names the two differentiators that the old description omitted', () => {
    expect(metadata.description).toMatch(/on-device/i);
    expect(metadata.description).toMatch(/\bMCP\b|agent/i);
  });

  it('spells the brand with the casing each field requires, wherever it appears', () => {
    // Guards the guard: if the manifest ever stops naming the brand anywhere, the loop below has
    // nothing to assert on and would pass silently.
    expect(brandOccurrences.length).toBeGreaterThan(0);

    for (const { label, value, spelling, requiredCasing } of brandOccurrences) {
      expect(spelling, `${label} contains "${spelling}" in "${value}"`).toBe(requiredCasing);
    }
  });

  it('points homepage at the docs site', () => {
    expect(metadata.homepage).toBe('https://leclap.dev');
  });

  it('carries at most 20 topics, each in GitHub required format', () => {
    expect(metadata.topics.length).toBeLessThanOrEqual(20);
    expect(metadata.topics.length).toBeGreaterThanOrEqual(10);
    for (const topic of metadata.topics) {
      // Lowercase alphanumeric, hyphens only between characters, 50 max. A trailing hyphen
      // (`mcp-`) is rejected by the topics endpoint, so it has to be rejected here too.
      expect(topic, `topic "${topic}"`).toMatch(/^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/);
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
