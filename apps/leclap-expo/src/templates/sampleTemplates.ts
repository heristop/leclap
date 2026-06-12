import type { TemplateDescriptor, Section } from '@/src/types';
import portraitDescriptor from './server/portrait.json';
import quickDescriptor from './server/quick.json';
import premiumIntroDescriptor from './premium/premium_intro.json';
import premiumQuoteDescriptor from './premium/premium_quote.json';
import premiumTitlesDescriptor from './premium/premium_titles.json';
import premiumReelPortraitDescriptor from './premium/premium_reel_portrait.json';
import premiumQuotePortraitDescriptor from './premium/premium_quote_portrait.json';

/** A template in the local catalog — bundled (on-device ready), or a user-created one. */
export interface CatalogTemplate {
  id: string;
  name: string;
  description: string;
  orientation: 'landscape' | 'portrait';
  descriptor: TemplateDescriptor;
  source: 'sample' | 'user';
}

/**
 * The local catalog is the set that compiles ON THE PHONE. It mirrors the server's scenarios
 * (`packages/server-app/templates`, copied by `scripts/copy-core-assets.mjs`) but rewrites the server-only
 * bits the on-device LGPL engine can't honour:
 *   - `useVideoSection` on a `project_video` section is a server-asset reference; on-device the user's
 *     recorded clip (keyed by section name) is used, and the validator rejects the dangling reference.
 *   - `boxblur` is a GPL filter (absent from our LGPL build) → remapped to `gblur` (Gaussian, LGPL).
 * Scenarios that need animated overlays (e.g. the Showcase) are server-only and come from the Cloud
 * fetch instead — they are not in this local set.
 */
const stripUseVideoSection = (section: Section): Section => {
  if (section.type !== 'project_video' || !section.options?.useVideoSection) {
    return section;
  }

  const { useVideoSection: _dropped, ...options } = section.options as Record<string, unknown>;

  return { ...section, options };
};

// GPL filters → LGPL equivalents (the on-device build is LGPL-only). boxblur → gblur (radius ≈ sigma).
const GPL_FILTER_REMAP: Record<string, string> = { boxblur: 'gblur' };

const remapGplFilters = (section: Section): Section => {
  if (!Array.isArray(section.filters)) {
    return section;
  }

  const filters = section.filters.map((entry) => {
    const filter = entry as { type?: string };
    const replacement = filter.type ? GPL_FILTER_REMAP[filter.type] : undefined;

    return replacement ? { ...filter, type: replacement } : entry;
  });

  return { ...section, filters };
};

const adaptForOnDevice = (descriptor: TemplateDescriptor): TemplateDescriptor => ({
  ...descriptor,
  sections: descriptor.sections?.map((section: Section) => remapGplFilters(stripUseVideoSection(section))),
});

const orientationOf = (descriptor: TemplateDescriptor): 'landscape' | 'portrait' =>
  descriptor.global?.orientation === 'portrait' ? 'portrait' : 'landscape';

const bundled = (id: string, name: string, description: string, raw: unknown): CatalogTemplate => {
  const descriptor = adaptForOnDevice(raw as TemplateDescriptor);

  return { id, name, description, orientation: orientationOf(descriptor), source: 'sample', descriptor };
};

export const SAMPLE_TEMPLATES: CatalogTemplate[] = [
  bundled(
    'premium-intro',
    'Premium Intro',
    'Cinematic title card — bold name, accent rule, graded backdrop.',
    premiumIntroDescriptor
  ),
  bundled(
    'premium-reel-portrait',
    'Premium Reel',
    'Vertical social reel — graded backdrop, bold caption.',
    premiumReelPortraitDescriptor
  ),
  bundled('premium-quote', 'Premium Quote', 'Typographic quote card with staged text reveal.', premiumQuoteDescriptor),
  bundled(
    'premium-quote-portrait',
    'Premium Quote (Portrait)',
    'Vertical typographic quote card.',
    premiumQuotePortraitDescriptor
  ),
  bundled('premium-titles', 'Premium Titles', 'Layered title sequence with eased typography.', premiumTitlesDescriptor),
  bundled('server-quick', 'Quick Card', 'Type a short message onto a brand-colored card.', quickDescriptor),
  bundled('server-portrait', 'Portrait', 'Record a clip, blur the backdrop and overlay a keyword.', portraitDescriptor),
];
