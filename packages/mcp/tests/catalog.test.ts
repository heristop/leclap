import 'reflect-metadata';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TemplateDescriptorSchema } from 'ffmpeg-video-composer';
import { expandPartialsSafe } from '@leclap/creative-kit/partials';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { builtinTemplates } from '../src/catalog/templates.generated.js';
import { listTemplateSummaries, getTemplate } from '../src/catalog/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const creativeKitRoot = path.resolve(here, '../../creative-kit');
// The MCP catalog ships every @leclap/creative-kit template descriptor. Test/scenario fixtures
// are outside this directory and are intentionally NOT cataloged.
const TEMPLATE_DIR = path.join(creativeKitRoot, 'src/templates');
const EXPECTED_IDS = fs
  .readdirSync(TEMPLATE_DIR)
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.replace(/\.json$/, ''))
  .sort();

function readSourceJson(id: string): unknown {
  const file = path.join(TEMPLATE_DIR, `${id}.json`);

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
      const expansion = expandPartialsSafe(builtinTemplates[id]);
      expect(expansion.ok, `${id} partial expansion should succeed`).toBe(true);
      if (!expansion.ok) continue;
      const result = TemplateDescriptorSchema.safeParse(expansion.data);

      expect(result.success, `${id} should parse`).toBe(true);
    }
  });
});

describe('listTemplateSummaries', () => {
  const summaries = listTemplateSummaries();
  const byId = (id: string) => summaries.find((s) => s.id === id)!;

  it('derives descriptions from descriptor metadata', () => {
    for (const summary of summaries) {
      expect(summary.description, `${summary.id} description`).not.toEqual('');
      expect(summary.description).not.toEqual('Built-in template (no description available)');
    }
  });

  it('derives requiredVideoSections from project_video sections', () => {
    // Every app template wraps a single `project_video` section named `video_1`.
    expect(byId('intro').requiredVideoSections).toEqual(['video_1']);
    expect(byId('titles').requiredVideoSections).toEqual(['video_1']);
  });

  it('flags requiresNetwork false — app templates ship only bundled assets', () => {
    expect(byId('intro').requiresNetwork).toBe(false);
    expect(byId('reel-portrait').requiresNetwork).toBe(false);
  });

  it('reads orientation from global (portrait stays portrait)', () => {
    expect(byId('reel-portrait').orientation).toBe('portrait');
    expect(byId('titles').orientation).toBe('landscape');
  });

  it('collects declared form field names', () => {
    expect(byId('intro').fields).toContain('form_1_firstname');
    expect(byId('titles').fields).toEqual([]);
  });
});

describe('getTemplate', () => {
  it('returns a descriptor for a known id and undefined otherwise', () => {
    expect(getTemplate('titles')).toBeDefined();
    expect(getTemplate('does-not-exist')).toBeUndefined();
  });
});

describe('template descriptor JSON Schema', () => {
  it('z.toJSONSchema does not throw and contains a sections key', () => {
    const jsonSchema = z.toJSONSchema(TemplateDescriptorSchema);
    expect(JSON.stringify(jsonSchema)).toContain('sections');
  });
});
