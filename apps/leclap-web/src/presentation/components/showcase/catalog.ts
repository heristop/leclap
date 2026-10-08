import catalog from '../../../../../../examples/showcase/catalog.json';

export const CATEGORIES = ['all', 'templates', 'typography', 'effects', 'overlays', 'app-demos', 'evidence'] as const;
export type ShowcaseCategory = (typeof CATEGORIES)[number];
export type ShowcaseSample = {
  id: string;
  title: string;
  description: string;
  category: Exclude<ShowcaseCategory, 'all'>;
  source: string;
  section?: string;
};

export const SHOWCASE_SAMPLES = catalog.samples as ShowcaseSample[];

// The samples the web library opens on, in this order: the HTML-layer samples. The catalog keeps its own
// order, which the CLI and the MCP list too; only the library here leads with these.
export const FEATURED_SAMPLE_IDS: readonly string[] = ['html-card', 'html-testimonial', 'html-speaker', 'html-stats'];

// The featured samples first, in their listed order, then every other sample in catalog order.
export function featuredFirst(samples: ShowcaseSample[], featured: readonly string[]): ShowcaseSample[] {
  const rank = (sample: ShowcaseSample): number => {
    const index = featured.indexOf(sample.id);

    return index === -1 ? featured.length : index;
  };

  return samples.toSorted((a, b) => rank(a) - rank(b));
}

export const LIBRARY_SAMPLES = featuredFirst(SHOWCASE_SAMPLES, FEATURED_SAMPLE_IDS);

export function validCategory(value: string | null): ShowcaseCategory {
  return CATEGORIES.find((category) => category === value) ?? 'all';
}

// The film the showcase opens on (and falls back to for an unknown id): the tour of every effect.
const DEFAULT_SAMPLE_ID = 'effects-tour';

export function selectedSample(id: string | null): ShowcaseSample {
  return (
    SHOWCASE_SAMPLES.find((sample) => sample.id === id) ??
    SHOWCASE_SAMPLES.find((sample) => sample.id === DEFAULT_SAMPLE_ID) ??
    SHOWCASE_SAMPLES[0]
  );
}

export function filterSamples(category: ShowcaseCategory, query: string): ShowcaseSample[] {
  const needle = query.trim().toLowerCase();

  return LIBRARY_SAMPLES.filter(
    (sample) =>
      (category === 'all' || sample.category === category) &&
      `${sample.title} ${sample.description}`.toLowerCase().includes(needle)
  );
}

export function mediaPath(sample: ShowcaseSample, extension: 'mp4' | 'webp' | 'json'): string {
  return `/videos/showcase/${sample.id}.${extension}`;
}
