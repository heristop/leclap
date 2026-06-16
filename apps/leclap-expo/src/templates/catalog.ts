import type { Template } from '@/src/types';
import { SAMPLE_TEMPLATES, type CatalogTemplate } from './sampleTemplates';
import type { UserTemplate } from '@/src/stores/useUserTemplateStore';

/**
 * The local, serverless template catalog. The app no longer fetches `/templates` from a server —
 * the list is bundled samples plus whatever the user composed in the editor (persisted on-device).
 * Both are mapped to the UI's `Template` shape ({ name, content }).
 */

const toTemplate = (entry: CatalogTemplate | UserTemplate): Template => ({
  name: entry.name,
  content: entry.descriptor,
  source: entry.source,
});

/** User templates first (most recently created on top), then the bundled samples. */
export const buildCatalog = (userTemplates: UserTemplate[]): Template[] => [
  ...userTemplates.map(toTemplate),
  ...SAMPLE_TEMPLATES.map(toTemplate),
];

/** Resolve a single template by name across user templates then samples. */
export const findInCatalog = (userTemplates: UserTemplate[], name: string): Template | undefined =>
  buildCatalog(userTemplates).find((t) => t.name === name);
