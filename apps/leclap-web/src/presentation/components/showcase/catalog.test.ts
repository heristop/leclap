import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fieldsFor } from '../../../../../../examples/showcase/fixtures.ts';
import { SHOWCASE_SAMPLES, filterSamples, selectedSample, validCategory } from './catalog';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../..');

describe('showcase catalog', () => {
  it('includes every shared app template and resolves every source', () => {
    const sources = new Set(SHOWCASE_SAMPLES.map((sample) => sample.source));
    for (const file of readdirSync(path.join(root, 'packages/leclap-creative-kit/src/templates'))) {
      if (file.endsWith('.json')) expect(sources.has(`packages/leclap-creative-kit/src/templates/${file}`)).toBe(true);
    }
    for (const sample of SHOWCASE_SAMPLES) expect(existsSync(path.join(root, sample.source))).toBe(true);
    expect(new Set(SHOWCASE_SAMPLES.map((sample) => sample.id)).size).toBe(SHOWCASE_SAMPLES.length);
  });

  it('combines category filtering with case-insensitive title and description search', () => {
    expect(filterSamples('typography', '  BLUR  ').map((sample) => sample.id)).toEqual(['editorial-blur-rise']);
    expect(filterSamples('overlays', 'blur')).toEqual([]);
    expect(filterSamples('all', 'opposing').map((sample) => sample.id)).toContain('type-impact');
    expect(filterSamples('all', '')).toHaveLength(SHOWCASE_SAMPLES.length);
  });

  it('recovers unknown URL values without a broken player', () => {
    expect(validCategory('missing')).toBe('all');
    expect(selectedSample('missing').id).toBe('type-impact');
    expect(selectedSample('square-promo').id).toBe('square-promo');
  });

  it('renders forms without options and keeps fixture values within authoring limits', () => {
    const defaults = { app: 'LeClap' };
    const fields = fieldsFor(
      {
        sections: [
          { type: 'form' },
          { type: 'form', options: { fields: [{ name: 'headline', label: { en: 'A longer title' }, maxLength: 4 }] } },
        ],
      },
      defaults
    );
    expect(fields).toEqual({ app: 'LeClap', headline: 'A lo' });
    expect(defaults).toEqual({ app: 'LeClap' });
  });

  it('ships a playable preview, poster and source for every sample', () => {
    const media = path.join(root, 'apps/leclap-web/public/videos/showcase');
    const manifest = JSON.parse(readFileSync(path.join(media, 'manifest.json'), 'utf8'));
    expect(manifest.samples.map((sample: { id: string }) => sample.id).sort()).toEqual(
      SHOWCASE_SAMPLES.map((sample) => sample.id).sort()
    );
    for (const sample of SHOWCASE_SAMPLES) {
      for (const extension of ['mp4', 'webp', 'json']) {
        expect(existsSync(path.join(media, `${sample.id}.${extension}`))).toBe(true);
      }
      expect(
        readFileSync(path.join(media, `${sample.id}.mp4`))
          .subarray(4, 8)
          .toString()
      ).toBe('ftyp');
      expect(
        readFileSync(path.join(media, `${sample.id}.webp`))
          .subarray(8, 12)
          .toString()
      ).toBe('WEBP');
    }
  });
});
