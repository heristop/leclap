import { describe, expect, it } from 'vitest';
import { templateDescriptorJsonSchema } from 'ffmpeg-video-composer/src/schemas/template.schemas.ts';
import { compactSchema, fitSchema } from './schema-digest';
import { generationContext, promptFor } from './generation-context';
import { buildSystemPrompt, buildUserBrief, DEFAULT_PROMPT_BUDGET } from './system-prompt';
import { artDirection, GENRE_FONTS } from './art-direction';

describe('art direction', () => {
  it('ships the story spine and the lazy-defaults block, without pinned centring or a fixed font trio', () => {
    const built = promptFor('30s product launch for a note-taking app', { genre: 'product-launch' });
    const direction = artDirection({ genre: 'product-launch' });

    expect(built.system).toContain('Story spine:');
    expect(built.system).toContain('Lazy defaults to avoid');
    expect(built.system).toContain('Everything centred.');
    expect(built.system).toContain('Purple-to-blue neon gradients.');
    expect(built.system).toContain('Every element entering at t=0');
    expect(built.system).toContain('"Welcome to…"');
    expect(built.system).toContain('slowest beat lasts at least 3× the fastest');
    expect(built.system).toContain('value claim by beat 2');
    expect(built.system).toContain('edge-anchored');
    expect(built.system).not.toContain('Centre with x');
    expect(built.system).not.toContain('BebasNeue, Anton, Oswald');
    expect(direction).not.toContain('(w-text_w)/2');
    expect(direction).toContain(GENRE_FONTS['product-launch']);
  });

  it('points at the theme tokens when a theme is set, and varies fonts by genre otherwise', () => {
    expect(artDirection({ theme: 'editorial' })).toContain('"$font.display"');
    expect(artDirection({ theme: 'editorial' })).toContain('"$color.accent"');
    expect(artDirection({ genre: 'cinematic-trailer' })).toContain('PlayfairDisplay.ttf');
    expect(artDirection({ genre: 'explainer' })).not.toContain('PlayfairDisplay.ttf');
    expect(artDirection({})).toContain('pick by tone');
  });
});

describe('schema digest', () => {
  it('shrinks the engine schema by an order of magnitude and stays valid JSON', () => {
    const raw = JSON.stringify(templateDescriptorJsonSchema).length;
    const digest = compactSchema(templateDescriptorJsonSchema, 120);

    expect(digest.length).toBeLessThan(raw / 4);
    expect(() => JSON.parse(digest) as unknown).not.toThrow();
  });

  it('keeps field names that collide with schema keywords (a section has a title and a description)', () => {
    const schema = {
      type: 'object',
      description: 'root',
      properties: { title: { type: 'string' }, description: { type: 'object' } },
    };
    const parsed = JSON.parse(compactSchema(schema, 0)) as {
      properties: Record<string, unknown>;
      description?: string;
    };

    expect(Object.keys(parsed.properties)).toEqual(['title', 'description']);
    expect(parsed.description).toBeUndefined();
  });

  it('clips descriptions harder to meet a budget, and flags a hard cut', () => {
    const roomy = fitSchema(templateDescriptorJsonSchema, 200_000);
    const tight = fitSchema(templateDescriptorJsonSchema, 40_000);
    const tiny = fitSchema(templateDescriptorJsonSchema, 1_000);

    expect(roomy.descriptionLength).toBe(160);
    expect(tight.text.length).toBeLessThanOrEqual(40_000);
    expect(tight.descriptionLength).toBeLessThan(160);
    expect(tiny.truncated).toBe(true);
    expect(tiny.text).toHaveLength(1_000);
  });
});

describe('buildSystemPrompt', () => {
  it('contains the contract, catalog, samples and schema, under the size budget', () => {
    const built = promptFor('30s product launch for a note-taking app, bold, punchy kinetic type', {
      orientation: 'portrait',
      genre: 'product-launch',
    });

    expect(built.system.length).toBeLessThanOrEqual(DEFAULT_PROMPT_BUDGET);
    expect(built.system).toContain('exactly ONE JSON object');
    expect(built.system).toContain('Template JSON Schema');
    expect(built.system).toContain('"sections"');
    expect(built.system).toContain('kenburns');
    expect(built.system).toContain('Motion catalog');
    expect(built.system).toContain('"kinetic"');
    expect(built.system).toContain('BebasNeue.ttf');
    expect(built.system).toContain('"doctrine":{"product-launch"');
    expect(built.system).not.toContain('"calm-tutorial":{"summary"');
    expect(built.system).toContain('"blueprints"');
    expect(built.sampleIds.length).toBeGreaterThan(0);
    expect(built.sampleIds).toContain('product-launch');
    expect(built.schemaTruncated).toBe(false);
  });

  it('drops samples before squeezing the schema below a minimum', () => {
    const context = generationContext();
    const built = buildSystemPrompt({
      schema: context.schema,
      catalog: context.catalog,
      samples: context.samples.slice(0, 3),
      hints: {},
      budget: 60_000,
    });

    expect(built.system.length).toBeLessThanOrEqual(60_000);
    expect(built.sampleIds.length).toBeLessThan(3);
  });

  it('only offers builder-compatible samples (no effect sections)', () => {
    for (const sample of generationContext().samples) {
      expect(sample.backend).toBe('native');
      expect((sample.template.sections ?? []).some((section) => section.type === 'effect')).toBe(false);
    }
  });
});

describe('buildUserBrief', () => {
  it('appends hints in plain words', () => {
    const brief = buildUserBrief('  calm tutorial intro, 3 steps ', {
      orientation: 'landscape',
      durationSeconds: 30,
      platform: 'youtube',
      energy: 0,
    });

    expect(brief).toContain('Brief: calm tutorial intro, 3 steps');
    expect(brief).toContain('Orientation: landscape');
    expect(brief).toContain('about 30 seconds');
    expect(brief).toContain('global.platform to "youtube"');
    expect(brief).toContain('Energy: calm');
  });

  it('asks for the chosen theme', () => {
    expect(buildUserBrief('x', { theme: 'midnight' })).toContain('global.theme to "midnight"');
  });

  it('omits the "none" platform', () => {
    expect(buildUserBrief('x', { platform: 'none' })).not.toContain('platform');
  });
});
