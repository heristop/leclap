import { declaresFields, resolveFields, type FieldIssue, type ResolvedFields } from '@/core/fields';
import type { ValidationError } from './types';

// Validation of a template that declares `global.fields` (core/fields): the descriptor is validated as it
// renders, with every declared field filled in, so a number in a numeric slot passes and a value the slot
// rejects fails AT that slot, re-coded as a field finding. With `values` (a render's own inputs) the
// resolution is strict and a missing or ill-typed value is an error; without, missing values are probed
// (getFieldWarnings reports them) so a template can be validated before anyone fills it in.

interface Validated {
  success: boolean;
  data?: unknown;
  errors?: ValidationError[];
}

type Values = Readonly<Record<string, unknown>>;

function issueError(issue: FieldIssue): ValidationError {
  return {
    path: `global.fields.${issue.field}`,
    message: issue.message,
    code: issue.code,
    hint: issue.hint,
    kind: 'judgement',
  };
}

function covers(errorPath: string, slot: string): boolean {
  return errorPath === slot || errorPath.startsWith(`${slot}.`);
}

// The declared field whose placeholder filled the slot an error points at, if any.
function fieldOf(error: ValidationError, resolved: ResolvedFields<unknown>): string | undefined {
  return resolved.substitutions.find((entry) => covers(error.path, entry.path))?.field;
}

function retag(error: ValidationError, resolved: ResolvedFields<unknown>): ValidationError {
  const field = fieldOf(error, resolved);

  if (field === undefined) return error;

  const missing = !Object.prototype.hasOwnProperty.call(resolved.values, field);

  return {
    path: error.path,
    message: `Field "${field}" does not fit this slot: ${error.message}`,
    code: missing ? 'field_missing_required' : 'field_type_mismatch',
    hint: `Give "${field}" a value this slot accepts, or change the field's type.`,
    kind: 'judgement',
  };
}

export function validateWithFields<T extends Validated>(
  data: unknown,
  values: Values | undefined,
  validate: (resolved: unknown) => T
): T {
  if (!declaresFields(data)) return validate(data);

  const strict = values !== undefined;
  const resolved = resolveFields(data, values, { probe: !strict });
  const result = validate(resolved.descriptor);
  const issues = strict ? resolved.issues : [];
  // A field already reported (missing, ill-typed) is not reported again at each slot it left unfilled.
  const reported = new Set(issues.map((issue) => issue.field));
  const slotErrors = (result.errors ?? []).map((error) => retag(error, resolved));
  const errors = [
    ...issues.map(issueError),
    ...slotErrors.filter((error) => !reported.has(fieldOf(error, resolved) ?? '')),
  ];

  return errors.length > 0 ? { ...result, success: false, errors } : result;
}
