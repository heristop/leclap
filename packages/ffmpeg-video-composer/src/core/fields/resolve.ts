import type { TemplateField } from '../../schemas/fields.schemas';
import { coerceFieldValue, probeValue, type FieldCoercers, type FieldValue } from './coerce';
import { declaredFields, declaresFields, hasEmptyValue } from './declared';

// Typed field resolution: each declared field's value (provided, else its default) is coerced by its type,
// then every `{{ name }}` of a declared field is filled across the descriptor. A placeholder that is the
// whole string takes the typed value (a number lands in a numeric slot as a number); one inside a longer
// string is interpolated as text through `encode`. Placeholders of undeclared names (variables, form fields
// without a declaration, partial variables) are left for the later passes, as before. The declarations
// themselves (`global.fields`) are never rewritten, so resolving a resolved descriptor is a no-op.
//
// Strict (default): a value that fails its type, or a required one that is missing, is an issue and its
// placeholders stay. Probe (`probe: true`, validation without values): such a field gets a stand-in of its
// type instead, so the rest of the template can still be validated; the issue is still reported.

export type FieldIssueCode = 'field_type_mismatch' | 'field_missing_required';

export interface FieldIssue {
  field: string;
  code: FieldIssueCode;
  message: string;
  hint: string;
}

/** One placeholder of a declared field, at a dotted path (`sections.0.options.duration`). */
export interface FieldSubstitution {
  path: string;
  field: string;
  /** The placeholder was the whole string, so the slot received the typed value. */
  whole: boolean;
}

export interface ResolveFieldsOptions {
  probe?: boolean;
  coercers?: FieldCoercers;
  /** How a value is written into a longer string (default String). The hook for a future escaping need. */
  encode?: (value: FieldValue, field: TemplateField) => string;
}

export interface ResolvedFields<T> {
  descriptor: T;
  values: Record<string, FieldValue>;
  substitutions: FieldSubstitution[];
  issues: FieldIssue[];
}

type Provided = Readonly<Record<string, unknown>> | undefined;
type Path = ReadonlyArray<string | number>;

function owns(record: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;
const WHOLE_PLACEHOLDER = /^\{\{\s*(\w+)\s*\}\}$/;

function providedValue(field: TemplateField, provided: Provided): unknown {
  const raw = provided && owns(provided, field.name) ? provided[field.name] : undefined;

  return raw === undefined || raw === '' ? field.default : raw;
}

function missingIssue(field: TemplateField): FieldIssue {
  const why = field.required ? 'is required' : `has no default (a ${field.type} field cannot be left empty)`;

  return {
    field: field.name,
    code: 'field_missing_required',
    message: `Field "${field.name}" ${why} and no value was given`,
    hint: `Give "${field.name}" a default, or pass a value (leclap render --set ${field.name}=…, MCP fields).`,
  };
}

function mismatchIssue(field: TemplateField, reason: string, fromDefault: boolean): FieldIssue {
  const source = fromDefault ? 'default' : 'value';

  return {
    field: field.name,
    code: 'field_type_mismatch',
    message: `Field "${field.name}" (${field.type}): the ${source} does not fit — ${reason}`,
    hint: fromDefault
      ? `Change the default of "${field.name}" to a valid ${field.type}.`
      : `Pass a valid ${field.type}.`,
  };
}

interface FieldOutcome {
  value?: FieldValue;
  issue?: FieldIssue;
}

function fallback(field: TemplateField, issue: FieldIssue, probe: boolean): FieldOutcome {
  const stand = probe ? probeValue(field) : null;

  return stand === null ? { issue } : { value: stand, issue };
}

function fieldOutcome(field: TemplateField, provided: Provided, options: ResolveFieldsOptions): FieldOutcome {
  const raw = providedValue(field, provided);
  const probe = options.probe ?? false;

  if (raw === undefined) {
    if (!field.required && hasEmptyValue(field)) return { value: '' };

    return fallback(field, missingIssue(field), probe);
  }

  const coerced = coerceFieldValue(field, raw, options.coercers);

  if (coerced.ok) return { value: coerced.value };

  const fromDefault = raw === field.default && !(provided && owns(provided, field.name));

  return fallback(field, mismatchIssue(field, coerced.reason, fromDefault), probe);
}

interface Walk {
  declared: ReadonlyMap<string, TemplateField>;
  values: Readonly<Record<string, FieldValue>>;
  encode: (value: FieldValue, field: TemplateField) => string;
  substitutions: FieldSubstitution[];
}

function fillString(text: string, path: Path, walk: Walk): unknown {
  const whole = WHOLE_PLACEHOLDER.exec(text);

  if (whole && walk.declared.has(whole[1])) {
    walk.substitutions.push({ path: path.join('.'), field: whole[1], whole: true });

    return owns(walk.values, whole[1]) ? walk.values[whole[1]] : text;
  }

  return text.replace(PLACEHOLDER, (match, name: string) => {
    const field = walk.declared.get(name);

    if (!field) return match;

    walk.substitutions.push({ path: path.join('.'), field: name, whole: false });

    return owns(walk.values, name) ? walk.encode(walk.values[name], field) : match;
  });
}

function isDeclarations(path: Path, key: string): boolean {
  return path.length === 1 && path[0] === 'global' && key === 'fields';
}

function fill(node: unknown, path: Path, walk: Walk): unknown {
  if (typeof node === 'string') return fillString(node, path, walk);

  if (Array.isArray(node)) return node.map((item, index) => fill(item, [...path, index], walk));

  if (node === null || typeof node !== 'object') return node;

  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => [
      key,
      isDeclarations(path, key) ? value : fill(value, [...path, key], walk),
    ])
  );
}

export function resolveFields<T>(
  descriptor: T,
  provided?: Provided,
  options: ResolveFieldsOptions = {}
): ResolvedFields<T> {
  if (!declaresFields(descriptor)) return { descriptor, values: {}, substitutions: [], issues: [] };

  const fields = declaredFields((descriptor as { global?: unknown }).global);
  const values: Record<string, FieldValue> = {};
  const issues: FieldIssue[] = [];

  for (const field of fields) {
    const outcome = fieldOutcome(field, provided, options);

    if (outcome.value !== undefined) values[field.name] = outcome.value;

    if (outcome.issue) issues.push(outcome.issue);
  }

  const walk: Walk = {
    declared: new Map(fields.map((field) => [field.name, field])),
    values,
    encode: options.encode ?? ((value) => String(value)),
    substitutions: [],
  };

  return { descriptor: fill(descriptor, [], walk) as T, values, substitutions: walk.substitutions, issues };
}

export class FieldResolutionError extends Error {
  constructor(readonly issues: FieldIssue[]) {
    super(`Template fields: ${issues.map((issue) => issue.message).join('; ')}`);
    this.name = 'FieldResolutionError';
  }
}

/** Strict resolution for a render: the resolved descriptor, or a FieldResolutionError naming every issue. */
export function assertFieldsResolved<T>(descriptor: T, provided?: Provided, options: ResolveFieldsOptions = {}): T {
  const resolved = resolveFields(descriptor, provided, { ...options, probe: false });

  if (resolved.issues.length > 0) throw new FieldResolutionError(resolved.issues);

  return resolved.descriptor;
}
