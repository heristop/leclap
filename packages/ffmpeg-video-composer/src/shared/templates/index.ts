// The single shared list of templates SHIPPED IN THE APPS (web + expo). This is the source of
// truth for the in-app catalog: each entry pairs a raw descriptor (authored once in this folder)
// with the metadata the apps need. Expo's `sampleTemplates` and web's `coreTemplateService` both
// build their catalogs from `APP_TEMPLATES` — no per-app copies of the JSON or the metadata.
//
// Templates that exist only for tests / MCP examples / server scenarios live under the package's
// `tests/fixtures/` and are NOT listed here.
import type { TemplateDescriptor } from '../../core/types';
import landscapeSpotlight from './landscape-spotlight.json';
import portraitSpotlight from './portrait-spotlight.json';
import fastCurious from './fast-curious.json';
import intro from './intro.json';
import reelPortrait from './reel-portrait.json';
import quote from './quote.json';
import quotePortrait from './quote-portrait.json';
import titles from './titles.json';

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

// Ordered EASY → EXPERT: the spotlight templates are the gentlest starting point (record a clip,
// the intro/outro wrap it), and Fast & Curious is the most involved (partial bumper, two-tone
// flash cards, a this-or-that beat). The apps surface the catalog in this order.
export const APP_TEMPLATES: AppTemplate[] = [
  define(
    {
      id: 'landscape-spotlight',
      name: 'Landscape Spotlight',
      description: 'Record a clip — graded intro + outro wrap it into a polished video.',
      category: 'advanced',
    },
    landscapeSpotlight
  ),
  define(
    {
      id: 'portrait-spotlight',
      name: 'Portrait Spotlight',
      description: 'Record a vertical clip — graded intro + outro wrap it into a polished video.',
      category: 'portrait',
    },
    portraitSpotlight
  ),
  define(
    {
      id: 'intro',
      name: 'Intro',
      description: 'Cinematic title card — bold name, accent rule, graded backdrop.',
      category: 'advanced',
    },
    intro
  ),
  define(
    {
      id: 'titles',
      name: 'Titles',
      description: 'Layered title sequence with eased typography.',
      category: 'advanced',
    },
    titles
  ),
  define(
    {
      id: 'quote',
      name: 'Quote',
      description: 'Typographic quote card with staged text reveal.',
      category: 'advanced',
    },
    quote
  ),
  define(
    {
      id: 'quote-portrait',
      name: 'Quote (Portrait)',
      description: 'Vertical typographic quote card.',
      category: 'portrait',
    },
    quotePortrait
  ),
  define(
    {
      id: 'reel-portrait',
      name: 'Reel',
      description: 'Vertical social reel — graded backdrop, bold caption.',
      category: 'portrait',
    },
    reelPortrait
  ),
  define(
    {
      id: 'fast-curious',
      name: 'Fast & Curious',
      description: 'Punchy two-tone flash intro — your name on a bold cut, then your clip.',
      category: 'advanced',
    },
    fastCurious
  ),
];

export const APP_TEMPLATES_BY_ID: Record<string, AppTemplate | undefined> = Object.fromEntries(
  APP_TEMPLATES.map((t) => [t.id, t])
);
