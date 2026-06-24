import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { compile } from '@/index';
import { TemplateDescriptorSchema } from '@/schemas/template.schemas';
import type { ProjectConfig, TemplateDescriptor } from '@/core/types';

// Real-render coverage for the ffmpeg-feature sugar added to the descriptor engine: text shadow/outline,
// LUT looks (lut3d), chroma-key background removal (colorkey) and animated overlay motion (overlay
// x/y expressions). Each fixture is validated against the schema (so the new fields parse) and then
// smoke-compiled through the Node engine (so the full filtergraph builds and renders on real ffmpeg).
// The per-option lowering is asserted in the unit suites (text/lut-library/managers/input-sources);
// these prove the options survive validation and produce a valid graph end to end.
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const libDir = path.resolve(repoRoot, 'packages/leclap-creative-kit/src/library');
const fixturesDir = path.resolve(here, 'fixtures');
// A per-file build dir so this suite never shares build/output.mp4 with the other parallel real-compile
// suites (a sibling's end-of-run cleanup would otherwise delete this file's output mid-render — a race).
const buildDir = path.resolve(repoRoot, 'build/effects-fixtures');

const FIXTURES = ['effects-text', 'effects-lut', 'effects-chromakey', 'effects-overlay-motion', 'sample'];

function load(id: string): TemplateDescriptor {
  return JSON.parse(fs.readFileSync(path.resolve(fixturesDir, `${id}.json`), 'utf8')) as TemplateDescriptor;
}

describe('effect fixtures validate against the descriptor schema', () => {
  for (const id of FIXTURES) {
    it(`${id} is a valid descriptor`, () => {
      const result = TemplateDescriptorSchema.safeParse(load(id));
      expect(result.success, `${id} should validate: ${JSON.stringify(result.error?.issues ?? [])}`).toBe(true);
    });
  }
});

describe('effect fixtures compile through the Node engine', () => {
  for (const id of FIXTURES) {
    it(`compiles ${id}`, async () => {
      const descriptor = load(id);

      const projectConfig = {
        buildDir,
        assetsDir: libDir,
        currentLocale: 'en',
        audioConfig: { sampleRate: 44100, channelLayout: 'stereo' },
        videoConfig: { orientation: 'landscape', scale: '1280:720' },
        fields: {},
        userVideoPaths: {},
      } as unknown as ProjectConfig;

      const out = await compile(projectConfig, descriptor);
      expect(out, `${id} should compile`).not.toBeNull();
    }, 180000);
  }
});
