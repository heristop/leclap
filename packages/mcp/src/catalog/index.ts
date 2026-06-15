import type { TemplateDescriptor } from 'ffmpeg-video-composer';

import { builtinTemplates } from './templates.generated.js';

// A flattened, agent-friendly view of a built-in template — just enough for an agent to pick a
// starting point to copy and customize, without parsing the full descriptor.
export interface TemplateSummary {
  id: string;
  description: string;
  orientation: 'landscape' | 'portrait';
  musicEnabled: boolean;
  requiredVideoSections: string[];
  fields: string[];
  requiresNetwork: boolean;
}

type Sections = NonNullable<TemplateDescriptor['sections']>;
type Section = Sections[number];
type TemplateMeta = {
  description?: unknown;
};

function describe(template: TemplateDescriptor): string {
  const description = (template as TemplateDescriptor & { meta?: TemplateMeta }).meta?.description;

  return typeof description === 'string' && description.length > 0
    ? description
    : 'Built-in template (no description available)';
}

// The core's hand-written descriptor type widens `orientation` to `string`; narrow it back to
// the documented union, defaulting anything unexpected (incl. undefined) to landscape.
function orientationOf(template: TemplateDescriptor): 'landscape' | 'portrait' {
  return template.global?.orientation === 'portrait' ? 'portrait' : 'landscape';
}

// Same rule as server-app's `validateCompileRequest`: only `project_video` sections need the
// user to supply recorded clips at compose time.
function requiredVideoSections(sections: Sections): string[] {
  return sections.filter((s) => s.type === 'project_video' && typeof s.name === 'string').map((s) => s.name as string);
}

function sectionFields(section: Section): string[] {
  const fields = section.options?.fields ?? [];

  return fields.map((field) => field.name);
}

function collectFields(sections: Sections): string[] {
  return sections.flatMap(sectionFields);
}

// Cheap-but-correct-enough network probe: any descriptor referencing an http(s) URL needs the
// network to resolve that asset at compose time.
function requiresNetwork(template: TemplateDescriptor): boolean {
  return JSON.stringify(template).includes('"http');
}

function summarize(id: string, template: TemplateDescriptor): TemplateSummary {
  const sections = template.sections ?? [];

  return {
    id,
    description: describe(template),
    orientation: orientationOf(template),
    musicEnabled: template.global?.musicEnabled ?? false,
    requiredVideoSections: requiredVideoSections(sections),
    fields: collectFields(sections),
    requiresNetwork: requiresNetwork(template),
  };
}

export function listTemplateSummaries(): TemplateSummary[] {
  return Object.entries(builtinTemplates).map(([id, template]) => summarize(id, template));
}

export function getTemplate(id: string): TemplateDescriptor | undefined {
  return builtinTemplates[id];
}

export function templateIds(): string[] {
  return Object.keys(builtinTemplates);
}
