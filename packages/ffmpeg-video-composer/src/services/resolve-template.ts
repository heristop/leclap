import { resolveFields, type FieldValue } from '@/core/fields';
import { expandPartialsSafe } from '@/core/partials';
import { applyVariables } from '@/core/partial-variables';
import { BaseTemplateValidator } from './BaseTemplateValidator';
import type { ValidationError } from './validation/types';

// The descriptor a render would see for the given values (`leclap resolve`, MCP get_resolved_template):
// partials expanded, declared fields filled with their typed values (core/fields), then the remaining
// placeholders filled from global.variables and the plain form values, the order the engine applies them.
// `errors` is what the render's validation would refuse with these values (strict on declared fields).

export interface ResolvedTemplate {
  descriptor: unknown;
  /** The typed value of every declared field that has one. */
  values: Record<string, FieldValue>;
  errors: ValidationError[];
}

type Values = Readonly<Record<string, unknown>>;

function textValues(record: unknown): Record<string, string> {
  if (record === null || typeof record !== 'object') return {};

  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : String(value)])
  );
}

export function resolveTemplate(
  template: unknown,
  values: Values = {},
  options: { format?: string } = {}
): ResolvedTemplate {
  const expansion = expandPartialsSafe(template);

  if (!expansion.ok) return { descriptor: template, values: {}, errors: [expansion.error] };

  const typed = resolveFields(expansion.data, values);
  const variables = textValues((typed.descriptor as { global?: { variables?: unknown } }).global?.variables);
  const merged = applyVariables(applyVariables(typed.descriptor, variables), textValues(values));
  const validation = new BaseTemplateValidator().validateTemplate(template, { fields: values, format: options.format });

  return { descriptor: merged, values: typed.values, errors: validation.errors ?? [] };
}
