import type { TemplateDescriptor } from '@/src/types';
import { APP_TEMPLATES } from '@leclap/creative-kit';

/** A template in the local catalog — a bundled @leclap/creative-kit sample, or a user-created one. */
export interface CatalogTemplate {
  id: string;
  name: string;
  description: string;
  orientation: 'landscape' | 'portrait';
  descriptor: TemplateDescriptor;
  source: 'sample' | 'user';
}

// The on-device catalog is authored once in @leclap/creative-kit — the single source of templates,
// shared with the web app. Every entry compiles on the phone as-is: the core remaps the GPL-only
// `eq` filter (used by the colour-grade looks) to an LGPL `lutyuv` LUT for the on-device engine, so
// no app-side descriptor rewriting is needed.
export const SAMPLE_TEMPLATES: CatalogTemplate[] = APP_TEMPLATES.map((t) => ({
  id: t.id,
  name: t.name,
  description: t.description,
  orientation: t.orientation,
  source: 'sample',
  descriptor: t.descriptor as unknown as TemplateDescriptor,
}));
