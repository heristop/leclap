// The single shared list of templates SHIPPED IN THE APPS (web + expo). This is the source of
// truth for the in-app catalog: each entry pairs a raw descriptor (authored once in this folder)
// with the metadata the apps need. Expo's `sampleTemplates` and web's `coreTemplateService` both
// build their catalogs from `APP_TEMPLATES` — no per-app copies of the JSON or the metadata.
//
// Templates that exist only for tests / MCP examples / server scenarios live under the package's
// `tests/fixtures/` and are NOT listed here.
import type { TemplateDescriptor } from '../../core/types';
import premiumSpotlight from './premium_spotlight.json';
import premiumIntro from './premium_intro.json';
import premiumReelPortrait from './premium_reel_portrait.json';
import premiumQuote from './premium_quote.json';
import premiumQuotePortrait from './premium_quote_portrait.json';
import premiumTitles from './premium_titles.json';

export type AppTemplateCategory = 'advanced' | 'portrait';

export interface AppTemplate {
  /** Stable catalog id (hyphenated), shared by web + expo. */
  id: string;
  name: string;
  description: string;
  category: AppTemplateCategory;
  orientation: 'landscape' | 'portrait';
  /** True when the descriptor has a `form` section (the app collects fields before compiling). */
  hasForm: boolean;
  descriptor: TemplateDescriptor;
}

const orientationOf = (d: TemplateDescriptor): 'landscape' | 'portrait' =>
  d.global?.orientation === 'portrait' ? 'portrait' : 'landscape';

const hasFormOf = (d: TemplateDescriptor): boolean => (d.sections ?? []).some((s) => s.type === 'form');

interface AppTemplateMeta {
  id: string;
  name: string;
  description: string;
  category: AppTemplateCategory;
}

// orientation + hasForm are derived from the descriptor so they can never drift from the JSON.
const define = (meta: AppTemplateMeta, raw: unknown): AppTemplate => {
  const descriptor = raw as TemplateDescriptor;

  return { ...meta, orientation: orientationOf(descriptor), hasForm: hasFormOf(descriptor), descriptor };
};

export const APP_TEMPLATES: AppTemplate[] = [
  define(
    {
      id: 'premium-spotlight',
      name: 'Premium Spotlight',
      description: 'Record a clip — graded intro + outro wrap it into a polished video.',
      category: 'advanced',
    },
    premiumSpotlight
  ),
  define(
    {
      id: 'premium-intro',
      name: 'Premium Intro',
      description: 'Cinematic title card — bold name, accent rule, graded backdrop.',
      category: 'advanced',
    },
    premiumIntro
  ),
  define(
    {
      id: 'premium-reel-portrait',
      name: 'Premium Reel',
      description: 'Vertical social reel — graded backdrop, bold caption.',
      category: 'portrait',
    },
    premiumReelPortrait
  ),
  define(
    {
      id: 'premium-quote',
      name: 'Premium Quote',
      description: 'Typographic quote card with staged text reveal.',
      category: 'advanced',
    },
    premiumQuote
  ),
  define(
    {
      id: 'premium-quote-portrait',
      name: 'Premium Quote (Portrait)',
      description: 'Vertical typographic quote card.',
      category: 'portrait',
    },
    premiumQuotePortrait
  ),
  define(
    {
      id: 'premium-titles',
      name: 'Premium Titles',
      description: 'Layered title sequence with eased typography.',
      category: 'advanced',
    },
    premiumTitles
  ),
];

export const APP_TEMPLATES_BY_ID: Record<string, AppTemplate | undefined> = Object.fromEntries(
  APP_TEMPLATES.map((t) => [t.id, t])
);
