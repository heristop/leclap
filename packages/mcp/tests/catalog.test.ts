import 'reflect-metadata';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TemplateDescriptorSchema } from 'ffmpeg-video-composer';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { builtinTemplates } from '../src/catalog/templates.generated.js';
import { templateMetadata } from '../src/catalog/metadata.js';
import { listTemplateSummaries, getTemplate } from '../src/catalog/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const coreRoot = path.resolve(here, '../../ffmpeg-video-composer');
// The catalog ships ONLY the curated premium app templates (src/shared/templates). Test/scenario
// fixtures (tests/fixtures) are engine test inputs and are intentionally NOT cataloged.
const TEMPLATE_DIRS = [path.join(coreRoot, 'src/shared/templates')];

const EXPECTED_IDS = [
  'premium-fast-curious',
  'premium-intro',
  'premium-quote',
  'premium-quote-portrait',
  'premium-reel-portrait',
  'premium-spotlight',
  'premium-titles',
];

function readSourceJson(id: string): unknown {
  const file = TEMPLATE_DIRS.map((dir) => path.join(dir, `${id}.json`)).find((candidate) => fs.existsSync(candidate));

  if (!file) {
    throw new Error(`template ${id}.json not found in src/shared/templates`);
  }

  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

describe('builtinTemplates (generated)', () => {
  it('has all expected ids', () => {
    expect(Object.keys(builtinTemplates).sort()).toEqual([...EXPECTED_IDS].sort());
  });

  it('does not drift from the core source JSONs', () => {
    for (const id of EXPECTED_IDS) {
      expect(builtinTemplates[id]).toEqual(readSourceJson(id));
    }
  });

  it('every template passes the core descriptor schema', () => {
    for (const id of EXPECTED_IDS) {
      const result = TemplateDescriptorSchema.safeParse(builtinTemplates[id]);

      expect(result.success, `${id} should parse`).toBe(true);
    }
  });
});

describe('templateMetadata', () => {
  it('has a description for every template id', () => {
    for (const id of EXPECTED_IDS) {
      expect(templateMetadata[id], `${id} needs metadata`).toBeTypeOf('string');
    }
  });
});

describe('listTemplateSummaries', () => {
  const summaries = listTemplateSummaries();
  const byId = (id: string) => summaries.find((s) => s.id === id)!;

  it('derives requiredVideoSections from project_video sections', () => {
    // Every premium template wraps a single `project_video` section named `video_1`.
    expect(byId('premium-intro').requiredVideoSections).toEqual(['video_1']);
    expect(byId('premium-titles').requiredVideoSections).toEqual(['video_1']);
  });

  it('flags requiresNetwork false — premium templates ship only bundled assets', () => {
    expect(byId('premium-intro').requiresNetwork).toBe(false);
    expect(byId('premium-reel-portrait').requiresNetwork).toBe(false);
  });

  it('reads orientation from global (portrait stays portrait)', () => {
    expect(byId('premium-reel-portrait').orientation).toBe('portrait');
    expect(byId('premium-titles').orientation).toBe('landscape');
  });

  it('collects declared form field names', () => {
    expect(byId('premium-intro').fields).toContain('form_1_firstname');
    expect(byId('premium-titles').fields).toEqual([]);
  });
});

describe('getTemplate', () => {
  it('returns a descriptor for a known id and undefined otherwise', () => {
    expect(getTemplate('premium-titles')).toBeDefined();
    expect(getTemplate('does-not-exist')).toBeUndefined();
  });
});

describe('template descriptor JSON Schema', () => {
  it('z.toJSONSchema does not throw and contains a sections key', () => {
    const jsonSchema = z.toJSONSchema(TemplateDescriptorSchema);
    expect(JSON.stringify(jsonSchema)).toContain('sections');
  });
});
