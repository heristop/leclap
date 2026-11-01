import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderSamplePages } from '../../scripts/render-docs';
import { SAMPLE_PAGES } from './sample-pages';
import { SHOWCASE_SAMPLES } from '../presentation/components/showcase/catalog';

describe('curated watch pages', () => {
  it('renders substantive HTML, playable media, JSON downloads and canonical breadcrumbs for every page', async () => {
    const pages = await renderSamplePages();
    expect(Object.keys(pages)).toEqual(SAMPLE_PAGES.map(({ path }) => path));
    for (const page of SAMPLE_PAGES) {
      const html = pages[page.path];
      expect(html.match(/<h1\b/g)).toHaveLength(1);
      expect(html).toContain(page.explanation);
      expect(html).toContain('controls=""');
      expect(html).toContain(`/videos/showcase/${page.id}.mp4`);
      expect(html).toContain(`/videos/showcase/${page.id}.webp`);
      expect(html).toContain(`/videos/showcase/${page.id}.json`);
      expect(html).toContain('BreadcrumbList');
      const json = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
      expect(JSON.parse(json ?? '{}')['@type']).toBe('BreadcrumbList');
      expect(html).toContain(`https://leclap.dev${page.path}`);
      expect(SHOWCASE_SAMPLES.some(({ id }) => id === page.id)).toBe(true);
      const descriptor = JSON.parse(
        readFileSync(new URL(`../../public/videos/showcase/${page.id}.json`, import.meta.url), 'utf8')
      );
      expect(descriptor.sections.length).toBeGreaterThan(0);
    }
  });
});
