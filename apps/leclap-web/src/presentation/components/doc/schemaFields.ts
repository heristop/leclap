// Pure transforms that turn the engine's exported JSON Schema into readable field
// rows. Keeping these out of the React tree makes them unit-testable and keeps the
// docs page in lock-step with the schema (no hand-maintained field lists).
import { templateDescriptorJsonSchema } from 'ffmpeg-video-composer/src/schemas/template.schemas.ts';

// The JSON Schema is structurally typed (zod's z.toJSONSchema output). We only read
// a handful of keywords, so a narrow shape keeps the walker honest without `any`.
export interface JsonSchemaNode {
  type?: string | string[];
  description?: string;
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  items?: JsonSchemaNode;
  enum?: Array<string | number>;
  const?: string | number | boolean;
  anyOf?: JsonSchemaNode[];
  oneOf?: JsonSchemaNode[];
  minimum?: number;
  maximum?: number;
  default?: unknown;
}

export interface FieldRow {
  name: string;
  type: string;
  /** enum values / numeric range / default, pre-formatted for a "Constraints" cell. */
  constraints: string;
  description: string;
  required: boolean;
}

const schema = templateDescriptorJsonSchema as unknown as JsonSchemaNode;

// A single nullable property lookup. Routing every nested access through this keeps
// the walker honest against the schema's optionality (and lint-clean — the helper's
// return type, not the cast's inferred shape, drives narrowing).
function prop(node: JsonSchemaNode | undefined, key: string): JsonSchemaNode | undefined {
  return node?.properties?.[key];
}

// A compact, human type label for one node: collapses anyOf/oneOf unions, names
// arrays by their item type, and surfaces a literal const.
export function typeLabel(node: JsonSchemaNode): string {
  if (node.const !== undefined) return JSON.stringify(node.const);

  if (node.anyOf || node.oneOf) {
    const variants = node.anyOf ?? node.oneOf ?? [];
    const labels = variants.map(typeLabel);

    return [...new Set(labels)].join(' | ');
  }

  if (node.type === 'array') {
    const inner = node.items ? typeLabel(node.items) : 'unknown';

    return `${inner}[]`;
  }

  if (Array.isArray(node.type)) return node.type.join(' | ');

  return node.type ?? 'object';
}

// enum list (truncated), numeric range, and default — joined into one cell string.
export function constraintsLabel(node: JsonSchemaNode): string {
  const parts: string[] = [];
  const values = collectEnum(node);

  if (values.length > 0) {
    const shown = values.slice(0, 6).join(', ');
    parts.push(values.length > 6 ? `${shown}, …` : shown);
  }

  if (node.minimum !== undefined || node.maximum !== undefined) {
    const lo = node.minimum ?? '−∞';
    const hi = node.maximum ?? '∞';
    parts.push(`${lo}…${hi}`);
  }

  if (node.default !== undefined) parts.push(`default ${JSON.stringify(node.default)}`);

  return parts.join(' · ');
}

// Pull enum values out of a node or its union variants (transition.type is an anyOf
// of an enum + a "cut" const, so we flatten both).
function variantEnum(node: JsonSchemaNode): Array<string | number> {
  if (node.enum) return node.enum;

  if (node.const !== undefined) return [node.const as string | number];

  return [];
}

function collectEnum(node: JsonSchemaNode): Array<string | number> {
  if (node.enum) return node.enum;

  const variants = node.anyOf ?? node.oneOf ?? [];

  return variants.flatMap(variantEnum);
}

// Turn an object node's `properties` into ordered, readable field rows.
export function fieldRows(node: JsonSchemaNode | undefined): FieldRow[] {
  if (!node?.properties) return [];

  const required = new Set(node.required ?? []);

  return Object.entries(node.properties).map(([name, prop]) => ({
    name,
    type: typeLabel(prop),
    constraints: constraintsLabel(prop),
    description: prop.description ?? '',
    required: required.has(name),
  }));
}

// The canonical section variant — every oneOf member shares the same base fields, so
// the first one stands in for "a section". Its `options` differ per type, hence the
// union below.
function sectionVariants(): JsonSchemaNode[] {
  return prop(schema, 'sections')?.items?.oneOf ?? [];
}

// Union the `options` properties across every section type so the docs show the full
// surface (e.g. `layers` lives on color_background, `framingGuide` on project_video).
function unionOptions(): JsonSchemaNode {
  const merged: Record<string, JsonSchemaNode> = {};

  for (const variant of sectionVariants()) {
    const options = prop(variant, 'options')?.properties ?? {};

    for (const [key, value] of Object.entries(options)) {
      merged[key] ??= value;
    }
  }

  return { type: 'object', properties: merged };
}

// Merge a node's union variants (anyOf/oneOf) into a single object so a discriminated union — e.g.
// MotionEffect's kenburns | rotate | crop | flip — renders as one combined table. A plain object
// passes through unchanged.
function mergeVariants(node: JsonSchemaNode | undefined): JsonSchemaNode | undefined {
  const variants = node?.anyOf ?? node?.oneOf;

  if (!node || !variants) return node;

  const merged: Record<string, JsonSchemaNode> = {};

  for (const variant of variants) {
    for (const [key, value] of Object.entries(variant.properties ?? {})) {
      merged[key] ??= value;
    }
  }

  return { type: 'object', properties: merged };
}

// Reach into a nested effect node by walking section → properties → key.
function sectionProperty(key: string): JsonSchemaNode | undefined {
  return prop(sectionVariants()[0], key);
}

function optionProperty(key: string): JsonSchemaNode | undefined {
  for (const variant of sectionVariants()) {
    const found = prop(prop(variant, 'options'), key);

    if (found) return found;
  }

  return undefined;
}

export interface FieldGroup {
  id: string;
  title: string;
  summary: string;
  rows: FieldRow[];
}

// The grouped field reference rendered on the page — each group is schema-driven, so
// adding a field in the engine's zod schema surfaces here automatically.
export function fieldGroups(): FieldGroup[] {
  const global = schema.properties?.global;
  const section = sectionVariants()[0];

  const groups: Array<{ id: string; title: string; summary: string; node?: JsonSchemaNode }> = [
    {
      id: 'global',
      title: 'global',
      summary: 'Project-wide defaults and the choices a builder exposes to users.',
      node: global,
    },
    {
      id: 'section',
      title: 'section',
      summary: 'The base fields every section shares, whatever its type.',
      node: section,
    },
    {
      id: 'options',
      title: 'options',
      summary: 'Per-section knobs — duration, framing, fades, layers and more.',
      node: unionOptions(),
    },
    {
      id: 'transition',
      title: 'transition',
      summary: 'The boundary effect carrying one section into the next.',
      node: sectionProperty('transition'),
    },
    {
      id: 'grade',
      title: 'grade',
      summary: 'Manual colour grade, applied on top of any named look.',
      node: sectionProperty('grade'),
    },
    {
      id: 'motion',
      title: 'motion[]',
      summary: 'Per-section motion and geometric effects (Ken Burns, rotate, crop, flip), applied in order.',
      node: mergeVariants(sectionProperty('motion')?.items),
    },
    {
      id: 'audio',
      title: 'audio (global)',
      summary: 'The final-mix audio settings: volumes, normalisation, ducking.',
      node: global?.properties?.audio,
    },
    {
      id: 'framing-guide',
      title: 'framingGuide',
      summary: 'The silhouette overlay shown while recording a clip.',
      node: optionProperty('framingGuide'),
    },
    {
      id: 'layers',
      title: 'layers[]',
      summary: 'Background layers (solid or gradient) composited over a color_background section.',
      node: optionProperty('layers')?.items,
    },
    {
      id: 'inputs',
      title: 'inputs',
      summary: 'Animation assets composited over the section video.',
      node: sectionProperty('inputs')?.items,
    },
  ];

  return groups.map(({ id, title, summary, node }) => ({ id, title, summary, rows: fieldRows(node) }));
}
