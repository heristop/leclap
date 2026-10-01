import { z } from 'zod';

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonPropsSchema = Record<string, JsonValue>;
export const MAX_SCHEMA_DEPTH = 16;
export const MAX_SCHEMA_NODES = 1024;
const keywords: Record<string, string[]> = {
  object: ['properties', 'required', 'additionalProperties'],
  string: ['minLength', 'maxLength'],
  number: ['minimum', 'maximum'],
  integer: ['minimum', 'maximum'],
  boolean: [],
  array: ['items', 'minItems', 'maxItems'],
};
const boundKeys: Partial<Record<string, string[]>> = {
  string: ['minLength', 'maxLength'],
  array: ['minItems', 'maxItems'],
  number: ['minimum', 'maximum'],
  integer: ['minimum', 'maximum'],
};
export function catalogError(message: string): never {
  throw new Error(`effect_catalog_invalid: ${message}`);
}
export function assertSafeKey(key: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || key in Object.prototype || key === 'prototype') {
    catalogError(`unsafe property or asset key ${key}.`);
  }
}
function object(value: unknown, location: string): asserts value is Record<string, JsonValue> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) catalogError(`${location} must be an object.`);
}
function validateKeywords(schema: JsonPropsSchema, location: string): string {
  object(schema, location);

  if (typeof schema.type !== 'string' || !Object.hasOwn(keywords, schema.type)) {
    catalogError(`${location}: unsupported schema type.`);
  }
  const allowed = new Set(['type', 'description', 'default', 'enum', ...keywords[schema.type]]);

  for (const key of Object.keys(schema)) {
    if (!allowed.has(key)) catalogError(`${location}: unsupported keyword ${key}.`);
  }

  if ('description' in schema && typeof schema.description !== 'string') {
    catalogError(`${location}: invalid description.`);
  }

  return schema.type;
}
function validateBounds(schema: JsonPropsSchema, type: string, location: string): void {
  const keys = boundKeys[type];

  if (!keys) return;

  for (const key of keys) {
    if (!(key in schema)) continue;
    const value = schema[key];

    if (typeof value !== 'number' || !Number.isFinite(value)) catalogError(`${location}: invalid ${key}.`);

    if (['string', 'array'].includes(type) && (!Number.isInteger(value) || value < 0)) {
      catalogError(`${location}: invalid ${key}.`);
    }
  }
  const minimum = schema[keys[0]];
  const maximum = schema[keys[1]];

  if (typeof minimum === 'number' && typeof maximum === 'number' && minimum > maximum) {
    catalogError(`${location}: inverted bounds.`);
  }
}
function validateObject(schema: JsonPropsSchema, depth: number, location: string, budget: { nodes: number }): void {
  if (schema.additionalProperties !== false) catalogError(`${location}: objects require additionalProperties:false.`);
  object(schema.properties, `${location}.properties`);
  const properties = schema.properties;

  for (const [key, child] of Object.entries(properties)) {
    assertSafeKey(key);
    object(child, `${location}.${key}`);
    visitSchema(child, depth + 1, `${location}.${key}`, budget);
  }

  if ('required' in schema) {
    if (
      !Array.isArray(schema.required) ||
      schema.required.some((key) => typeof key !== 'string' || !Object.hasOwn(properties, key)) ||
      new Set(schema.required).size !== schema.required.length
    ) {
      catalogError(`${location}: required must name distinct declared properties.`);
    }
  }
}
function validateEnum(schema: JsonPropsSchema, type: string, location: string): void {
  if (!('enum' in schema)) return;

  if (type === 'object' || type === 'array' || !Array.isArray(schema.enum) || schema.enum.length === 0) {
    catalogError(`${location}: enum requires nonempty primitive values.`);
  }
  // The importer handles enum before type/bounds: every literal must satisfy both.
  const { enum: values, default: _default, ...underlying } = schema;
  const validator = z.fromJSONSchema(underlying);

  for (const value of values) {
    if (!validator.safeParse(value).success) catalogError(`${location}: enum value violates its type or bounds.`);
  }

  if (new Set(values.map((value) => JSON.stringify(value))).size !== values.length) {
    catalogError(`${location}: duplicate enum values.`);
  }
}
function visitSchema(schema: JsonPropsSchema, depth: number, location: string, budget: { nodes: number }): void {
  if (depth > MAX_SCHEMA_DEPTH) catalogError(`${location}: schema depth exceeds ${MAX_SCHEMA_DEPTH}.`);

  if (++budget.nodes > MAX_SCHEMA_NODES) catalogError(`schema node count exceeds ${MAX_SCHEMA_NODES}.`);
  const type = validateKeywords(schema, location);
  validateBounds(schema, type, location);

  if (type === 'object') validateObject(schema, depth, location, budget);

  if (type === 'array') {
    if (typeof schema.maxItems !== 'number' || schema.maxItems > 1000) {
      catalogError(`${location}: arrays require maxItems <= 1000.`);
    }
    object(schema.items, `${location}.items`);
    visitSchema(schema.items, depth + 1, `${location}.items`, budget);
  }
  validateEnum(schema, type, location);

  if ('default' in schema) {
    const { default: value, ...underlying } = schema;

    const parsedDefault = z.fromJSONSchema(underlying).safeParse(value);

    if (!parsedDefault.success) {
      catalogError(`${location}: default violates its schema.`);
    }
    // Zod defaults short circuit parsing; store the fully validated nested default.
    schema.default = parsedDefault.data as JsonValue;
  }
}
/** Bound and reject unsupported keywords before invoking Zod's permissive importer. */
export function compileCustomPropsSchema(
  input: JsonPropsSchema,
  budget = { nodes: 0 }
): z.ZodType<Record<string, unknown>> {
  visitSchema(input, 1, 'propsSchema', budget);

  if (input.type !== 'object') catalogError('propsSchema root must be a strict object.');

  return z.fromJSONSchema(input) as z.ZodType<Record<string, unknown>>;
}
