// Template "partials": reusable section fragments referenced from a template via
// `{ "type": "partial", "ref": "<id>" }` instead of being copy-pasted. Expanded at load — before
// validation and compilation — so the schema, validator, and engine only ever see real sections.
import type { TemplateDescriptor, TemplateSection, TemplatePartial } from './types';
// APP_PARTIALS is generated from src/partials/*.json by scripts/gen-partials.ts — declare a partial
// by dropping a JSON in src/partials/ (id = filename) and running `pnpm gen:partials`, no edit here.
import { APP_PARTIALS } from './partials.generated';

// TemplatePartial lives in ./types (so the generated registry can reference it without a cycle);
// re-exported here to keep `@leclap/creative-kit/partials` the single import site for consumers.
export type { TemplatePartial };

export { APP_PARTIALS };

interface PartialRefSection {
  type: 'partial';
  ref: string;
  prefix?: string;
  sections?: TemplateSection[];
  /** Values substituted into the partial's `{{ key }}` placeholders, so one partial serves many slots. */
  variables?: Record<string, string>;
}

const isPartialRef = (section: TemplateSection): section is TemplateSection & PartialRefSection =>
  (section as { type?: string }).type === 'partial';

export const partialsById = (partials: TemplatePartial[]): Record<string, TemplatePartial | undefined> =>
  Object.fromEntries(partials.map((partial) => [partial.id, partial]));

// Deep-replace every `{{ key }}` placeholder in a partial's sections with the matching ref variable.
// Keys absent from `variables` are left untouched, so a partial may still reference global template
// variables (resolved later by the engine). Values are inserted verbatim and never re-scanned.
function applyVariables<T>(node: T, variables: Record<string, string>): T {
  if (typeof node === 'string') {
    return node.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
      Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match
    ) as unknown as T;
  }

  if (Array.isArray(node)) {
    return node.map((item) => applyVariables(item, variables)) as unknown as T;
  }

  if (node !== null && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, applyVariables(value, variables)])) as T;
  }

  return node;
}

/**
 * Replace every `{ type: "partial", ref }` section with the referenced partial's real sections.
 * `prefix` (optional) is prepended to each expanded section's `name`, so the same partial can be
 * included more than once without name collisions. Idempotent (a descriptor with no partial refs is
 * returned unchanged) and throws on an unknown `ref`.
 */
export function expandPartialsWithRegistry(
  descriptor: TemplateDescriptor,
  partials: TemplatePartial[] = APP_PARTIALS
): TemplateDescriptor {
  const sections = descriptor.sections ?? [];

  if (!sections.some(isPartialRef)) {
    return descriptor;
  }

  const registry = partialsById(partials);
  const expanded: TemplateSection[] = [];

  for (const section of sections) {
    if (isPartialRef(section)) {
      expanded.push(...expandRefSection(section, registry));
      continue;
    }

    expanded.push(section);
  }

  return { ...descriptor, sections: expanded };
}

// Expand a single `{ type: "partial", ref }` section into its real sections: resolve the registry
// (or inline) sections, apply the partial's default variables merged under the ref's overrides, then
// prefix each section name. Throws on an unknown ref with no inline fallback.
function expandRefSection(
  section: TemplateSection & PartialRefSection,
  registry: Record<string, TemplatePartial | undefined>
): TemplateSection[] {
  const inlineSections = section.sections;
  const partial = section.ref ? registry[section.ref] : undefined;

  if (!partial && !inlineSections) {
    throw new Error(`Unknown template partial: "${section.ref}"`);
  }

  // The partial's own defaults first, then the ref's overrides — so a ref can recolour/retext a
  // partial while unspecified keys keep the partial's built-in values.
  const variables = { ...partial?.variables, ...section.variables };
  const sourceSections = partial?.sections ?? inlineSections ?? [];
  const applied = Object.keys(variables).length > 0 ? applyVariables(sourceSections, variables) : sourceSections;
  const prefix = section.prefix ?? '';

  return applied.map((s) => (prefix && typeof s.name === 'string' ? { ...s, name: `${prefix}${s.name}` } : s));
}

export function expandPartials(descriptor: TemplateDescriptor): TemplateDescriptor {
  return expandPartialsWithRegistry(descriptor, APP_PARTIALS);
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
