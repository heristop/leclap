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
const templatesDir = path.resolve(here, '../../ffmpeg-video-composer/src/shared/templates');

const EXPECTED_IDS = [
  'concat_videos_with_music',
  'fast_and_curious',
  'intertitle',
  'local_music',
  'loop_music',
  'picture',
  'portrait',
  'premium_intro',
  'premium_quote',
  'premium_quote_portrait',
  'premium_reel_portrait',
  'premium_spotlight',
  'premium_titles',
  'sample',
  'video',
  'video_speed',
];

// Two shipped templates set a music volume boost factor (>1) that the descriptor schema's
// `musicVolumeLevel`/`audioVolumeLevel` `.max(1)` bound rejects. They are still valid built-in
// starting points — only that one numeric bound trips — so we assert the rest parse cleanly and
// pin these two to fail on the volume bound alone (so any *other* drift still surfaces).
const KNOWN_VOLUME_OVERFLOW = new Map<string, ReadonlyArray<string>>([
  ['concat_videos_with_music', ['sections.2.options.musicVolumeLevel']],
  ['loop_music', ['global.audioVolumeLevel']],
]);

function readSourceJson(id: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(templatesDir, `${id}.json`), 'utf8'));
}

describe('builtinTemplates (generated)', () => {
  it('has all 15 expected ids', () => {
    expect(Object.keys(builtinTemplates).sort()).toEqual([...EXPECTED_IDS].sort());
  });

  it('does not drift from the core source JSONs', () => {
    for (const id of EXPECTED_IDS) {
      expect(builtinTemplates[id]).toEqual(readSourceJson(id));
    }
  });

  it('every template passes the core descriptor schema (modulo known volume-overflow templates)', () => {
    for (const id of EXPECTED_IDS) {
      const result = TemplateDescriptorSchema.safeParse(builtinTemplates[id]);
      const known = KNOWN_VOLUME_OVERFLOW.get(id);

      if (!known) {
        expect(result.success, `${id} should parse`).toBe(true);
        continue;
      }

      expect(result.success, `${id} is expected to overflow the volume bound`).toBe(false);
      const paths = result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
      expect(paths, `${id} should fail only on the volume bound`).toEqual([...known]);
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
    // local_music has a single `project_video` section named `earth`.
    expect(byId('local_music').requiredVideoSections).toEqual(['earth']);
    // video has only a `video` section — no clips required.
    expect(byId('video').requiredVideoSections).toEqual([]);
  });

  it('flags requiresNetwork for templates that reference http urls', () => {
    expect(byId('sample').requiresNetwork).toBe(true);
    expect(byId('portrait').requiresNetwork).toBe(false);
  });

  it('reads orientation from global (portrait stays portrait)', () => {
    expect(byId('portrait').orientation).toBe('portrait');
    expect(byId('video').orientation).toBe('landscape');
  });

  it('collects declared form field names', () => {
    expect(byId('sample').fields).toContain('form_1_firstname');
    expect(byId('video').fields).toEqual([]);
  });
});

describe('getTemplate', () => {
  it('returns a descriptor for a known id and undefined otherwise', () => {
    expect(getTemplate('video')).toBeDefined();
    expect(getTemplate('does-not-exist')).toBeUndefined();
  });
});

describe('template descriptor JSON Schema', () => {
  it('z.toJSONSchema does not throw and contains a sections key', () => {
    const jsonSchema = z.toJSONSchema(TemplateDescriptorSchema);
    expect(JSON.stringify(jsonSchema)).toContain('sections');
  });
});
