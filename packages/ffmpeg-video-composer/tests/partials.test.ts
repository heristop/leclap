import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import type { ProjectConfig, TemplateDescriptor } from '@/core/types';
import { expandPartials } from '@/shared/templates/partials';
import { TemplateValidator } from '@/services/TemplateValidator';
import { compile } from '@/index';
import fastCurious from '@/shared/templates/fast-curious.json';

const coreRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = 'https://github.com/heristop/ffmpeg-video-composer/raw/main/';
const localize = (value: unknown): unknown => {
  if (typeof value === 'string') return value.startsWith(RAW) ? path.join(coreRoot, value.slice(RAW.length)) : value;
  if (Array.isArray(value)) return value.map(localize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, localize(v)]));
  }
  return value;
};

describe('expandPartials', () => {
  it('replaces a { type:"partial" } section with the referenced partial sections', () => {
    const descriptor = {
      global: {},
      sections: [
        { name: 'bumper', type: 'partial', ref: 'logo-bumper' },
        { name: 'q1', type: 'form' },
      ],
    } as unknown as TemplateDescriptor;

    const out = expandPartials(descriptor);
    const sections = out.sections ?? [];

    // The logo-bumper partial is a single `video` section named `logo_bumper`.
    expect(sections.map((s) => s.type)).toEqual(['video', 'form']);
    expect(sections[0]?.name).toBe('logo_bumper');
  });

  it('throws on an unknown partial ref', () => {
    const descriptor = {
      sections: [{ name: 'x', type: 'partial', ref: 'does-not-exist' }],
    } as unknown as TemplateDescriptor;

    expect(() => expandPartials(descriptor)).toThrow(/does-not-exist/);
  });

  it('returns the descriptor unchanged when there are no partials (idempotent)', () => {
    const descriptor = { sections: [{ name: 'v', type: 'video' }] } as unknown as TemplateDescriptor;

    expect(expandPartials(descriptor)).toEqual(descriptor);
    // expanding twice is a no-op
    expect(expandPartials(expandPartials(descriptor))).toEqual(descriptor);
  });

  it('applies an optional name prefix so the same partial can be used more than once', () => {
    const descriptor = {
      sections: [{ name: 'intro', type: 'partial', ref: 'logo-bumper', prefix: 'intro_' }],
    } as unknown as TemplateDescriptor;

    const out = expandPartials(descriptor);

    expect(out.sections?.[0]?.name).toBe('intro_logo_bumper');
  });
});

describe('TemplateValidator + partials', () => {
  it('expands a partial before schema validation and returns the expanded descriptor', () => {
    const descriptor = {
      global: { orientation: 'landscape' },
      sections: [
        { name: 'bumper', type: 'partial', ref: 'logo-bumper' },
        { name: 'form_1', type: 'form', options: { fields: [] } },
      ],
    };

    const result = new TemplateValidator().validateTemplate(descriptor);

    expect(result.success).toBe(true);
    // The partial ref is gone — replaced by the partial's real `video` section.
    expect(result.data && 'sections' in result.data ? result.data.sections?.[0]?.type : undefined).toBe('video');
  });

  it('rejects an unknown partial ref with a clean error (not a crash)', () => {
    const result = new TemplateValidator().validateTemplate({
      sections: [{ name: 'x', type: 'partial', ref: 'no-such-partial' }],
    });

    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.message.includes('no-such-partial'))).toBe(true);
  });
});

describe('partial integration — fast & curious includes the logo-bumper partial', () => {
  it('expands the partial and compiles the whole template end-to-end', async () => {
    // The template's first section is `{ type: "partial", ref: "logo-bumper" }`.
    expect((fastCurious.sections[0] as { type?: string }).type).toBe('partial');

    // Expand here so the partial's bundled asset URL is localised for a hermetic compile (compile()
    // re-expands internally, a no-op once expanded).
    const expanded = expandPartials(fastCurious as unknown as TemplateDescriptor);
    expect(expanded.sections?.[0]?.name).toBe('logo_bumper');

    const clip = path.resolve(coreRoot, 'src/shared/assets/videos/video_1.mp4');
    const cfg: ProjectConfig = {
      buildDir: path.resolve(coreRoot, '../../build/partial-fc'),
      assetsDir: path.resolve(coreRoot, 'src/shared/assets'),
      currentLocale: 'en',
      audioConfig: { sampleRate: 44100, channelLayout: 'stereo' },
      videoConfig: { orientation: 'landscape', scale: '1280:720' },
      fields: { form_1_firstname: 'Emily' },
      userVideoPaths: { video_1: clip, video_2: clip, video_3: clip },
    };

    const out = await compile(cfg, localize(expanded) as TemplateDescriptor);

    expect(out).not.toBeNull();
  }, 240_000);
});
