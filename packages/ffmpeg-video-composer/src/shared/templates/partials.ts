// Template "partials": reusable section fragments referenced from a template via
// `{ "type": "partial", "ref": "<id>" }` instead of being copy-pasted. Expanded at load — before
// validation and compilation — so the schema, validator, and engine only ever see real sections.
import type { Section, TemplateDescriptor } from '../../core/types';
import logoBumper from './partials/logo-bumper.json';
import flashTransition from './partials/flash-transition.json';

export interface TemplatePartial {
  /** Stable id referenced by `{ type: "partial", ref }`. */
  id: string;
  description: string;
  /** The real sections this partial expands into. */
  sections: Section[];
}

export const APP_PARTIALS: TemplatePartial[] = [
  {
    id: 'logo-bumper',
    description: 'Animated LeClap clapperboard intro sting.',
    sections: (logoBumper as { sections: Section[] }).sections,
  },
  {
    id: 'flash-transition',
    description: 'Two-tone strobe — red/white halves swap on hard cuts, dropped between answer clips.',
    sections: (flashTransition as { sections: Section[] }).sections,
  },
];

const APP_PARTIALS_BY_ID: Record<string, TemplatePartial | undefined> = Object.fromEntries(
  APP_PARTIALS.map((partial) => [partial.id, partial])
);

interface PartialRefSection {
  type: 'partial';
  ref: string;
  prefix?: string;
}

const isPartialRef = (section: Section): section is Section & PartialRefSection =>
  (section as { type?: string }).type === 'partial';

/**
 * Replace every `{ type: "partial", ref }` section with the referenced partial's real sections.
 * `prefix` (optional) is prepended to each expanded section's `name`, so the same partial can be
 * included more than once without name collisions. Idempotent (a descriptor with no partial refs is
 * returned unchanged) and throws on an unknown `ref`.
 */
export function expandPartials(descriptor: TemplateDescriptor): TemplateDescriptor {
  const sections = descriptor.sections ?? [];

  if (!sections.some(isPartialRef)) {
    return descriptor;
  }

  const expanded: Section[] = [];

  for (const section of sections) {
    if (!isPartialRef(section)) {
      expanded.push(section);
      continue;
    }

    const partial = APP_PARTIALS_BY_ID[section.ref];

    if (!partial) {
      throw new Error(`Unknown template partial: "${section.ref}"`);
    }

    const prefix = section.prefix ?? '';
    expanded.push(...partial.sections.map((s) => (prefix ? { ...s, name: `${prefix}${s.name}` } : s)));
  }

  return { ...descriptor, sections: expanded };
}

export type PartialExpansion =
  | { ok: true; data: unknown }
  | { ok: false; error: { path: string; message: string; code: string } };

/**
 * Validation-friendly wrapper around {@link expandPartials}: passes non-objects through untouched
 * and turns an unknown-ref throw into a structured error instead of an exception. Used by the
 * validator so partials are expanded before the schema + reference checks run.
 */
export function expandPartialsSafe(templateData: unknown): PartialExpansion {
  if (templateData === null || typeof templateData !== 'object') {
    return { ok: true, data: templateData };
  }

  try {
    return { ok: true, data: expandPartials(templateData as TemplateDescriptor) };
  } catch (error) {
    return {
      ok: false,
      error: {
        path: 'partial',
        message: error instanceof Error ? error.message : 'Unknown template partial',
        code: 'unknown_partial',
      },
    };
  }
}
