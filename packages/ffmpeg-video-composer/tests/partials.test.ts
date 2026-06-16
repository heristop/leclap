import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import type { ProjectConfig, TemplateDescriptor } from '@/core/types';
import { APP_TEMPLATES_BY_ID } from '@leclap/creative-kit';
import { expandPartials as expandPartialsCk } from '@leclap/creative-kit/partials';
import { TemplateValidator } from '@/services/TemplateValidator';
import { compile } from '@/index';

// expandPartials is typed against creative-kit's structurally-looser descriptor (its types carry
// index signatures that core's strict zod-inferred types don't), so a core descriptor isn't directly
// assignable. Bridge once here so the core-typed fixtures below pass through unchanged.
const expandPartials = (descriptor: TemplateDescriptor): TemplateDescriptor =>
  expandPartialsCk(descriptor as Parameters<typeof expandPartialsCk>[0]) as unknown as TemplateDescriptor;

const coreRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const creativeKitRoot = path.resolve(coreRoot, '../leclap-creative-kit');
const RAW = 'https://github.com/heristop/ffmpeg-video-composer/raw/main/';
const localRawPath = (relative: string): string => {
  if (relative.startsWith('src/shared/assets/')) {
    return path.join(creativeKitRoot, 'src/library', relative.slice('src/shared/assets/'.length));
  }

  if (relative.startsWith('src/shared/library/')) {
    return path.join(creativeKitRoot, 'src/library', relative.slice('src/shared/library/'.length));
  }

  return path.join(coreRoot, '..', '..', relative);
};

const localize = (value: unknown): unknown => {
  if (typeof value === 'string') {
    if (!value.startsWith(RAW)) return value;

    return localRawPath(value.slice(RAW.length));
  }
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

  it('substitutes {{ variable }} placeholders from the ref variables map', () => {
    const descriptor = {
      sections: [
        {
          type: 'partial',
          ref: 'flash-card',
          prefix: 'q1_',
          variables: { optionA: 'Tea', optionB: 'Coffee' },
        },
      ],
    } as unknown as TemplateDescriptor;

    const out = expandPartials(descriptor);
    const json = JSON.stringify(out.sections);

    // Provided values are injected, placeholders are gone, and the prefix is applied.
    expect(json).toContain('Tea');
    expect(json).toContain('Coffee');
    expect(json).not.toContain('{{ optionA }}');
    expect(json).not.toContain('{{ optionB }}');
    expect(out.sections?.[0]?.name).toBe('q1_flash');
  });

  it('flash-card: defaults keep the "OR" separator (fast-curious path)', () => {
    const descriptor = {
      sections: [{ type: 'partial', ref: 'flash-card', variables: { optionA: 'Tea', optionB: 'Coffee' } }],
    } as unknown as TemplateDescriptor;

    const json = JSON.stringify(expandPartials(descriptor).sections);

    expect(json).toContain('"en":"OR"'); // conjunction default
    expect(json).toContain('Tea');
    expect(json).toContain('Coffee');
  });

  it('flash-card: a conjunction override swaps the separator', () => {
    const descriptor = {
      sections: [
        {
          type: 'partial',
          ref: 'flash-card',
          variables: { optionA: 'drink', optionB: 'code', conjunction: '&' },
        },
      ],
    } as unknown as TemplateDescriptor;

    const json = JSON.stringify(expandPartials(descriptor).sections);

    expect(json).toContain('"en":"&"'); // separator is now "&"
    expect(json).not.toContain('"en":"OR"'); // the OR is gone
  });

  it('flash-card: a bare ref (no variables) expands fully from defaults — no dangling {{ }}', () => {
    const descriptor = {
      sections: [{ type: 'partial', ref: 'flash-card' }],
    } as unknown as TemplateDescriptor;

    const json = JSON.stringify(expandPartials(descriptor).sections);

    // Every placeholder has a default, so nothing is left unsubstituted.
    expect(json).not.toMatch(/\{\{\s*\w+\s*\}\}/);
    expect(json).toContain('THIS');
    expect(json).toContain('THAT');
    expect(json).toContain('"en":"OR"');
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
    const data = result.data as TemplateDescriptor | undefined;
    expect(data?.sections?.[0]?.type).toBe('video');
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
    const fastCurious = APP_TEMPLATES_BY_ID['fast-curious']?.descriptor;

    expect(fastCurious).toBeDefined();
    // The template composes shared partials (flash-card cards between clips, logo-bumper outro).
    expect((fastCurious as TemplateDescriptor).sections?.some((s) => s.type === 'partial')).toBe(true);

    // Expand here so the partial's bundled asset URL is localised for a hermetic compile (compile()
    // re-expands internally, a no-op once expanded).
    const expanded = expandPartials(fastCurious as unknown as TemplateDescriptor);
    expect(expanded.sections?.some((s) => s.type === 'partial')).toBe(false);
    expect(expanded.sections?.some((s) => s.name === 'logo_bumper')).toBe(true);

    const clip = path.resolve(creativeKitRoot, 'src/library/videos/video_1.mp4');
    const cfg: ProjectConfig = {
      buildDir: path.resolve(coreRoot, '../../build/partial-fc'),
      assetsDir: path.resolve(creativeKitRoot, 'src/library'),
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
