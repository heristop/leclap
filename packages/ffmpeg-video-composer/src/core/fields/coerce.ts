import type { FieldType, TemplateField } from '../../schemas/fields.schemas';

// One coercer per field type: raw input (a CLI string, an MCP number, a default) → the typed value that is
// substituted, or the reason it does not fit. Pluggable: a host passes its own coercers per type to
// resolveFields (e.g. an HTML-escaping text coercer once some output needs it).

export type FieldValue = string | number;

export type Coerced = { ok: true; value: FieldValue } | { ok: false; reason: string };

export type FieldCoercer = (raw: unknown, field: TemplateField) => Coerced;

export type FieldCoercers = Partial<Record<FieldType, FieldCoercer>>;

const HEX_COLOR = /^(?:#|0x)(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i;
const NAMED_COLOR = /^[a-z]+(?:@(?:0?\.\d+|1(?:\.0+)?|0))?$/i;
const FUNCTION_COLOR = /^rgba?\([\d\s.,%/]+\)$/i;
const ABSOLUTE_URL = /^(?:[a-z][\da-z+.-]*:\/\/\S+|data:\S+)$/i;
const CLOCK = /^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/;

function fail(reason: string): Coerced {
  return { ok: false, reason };
}

function asText(raw: unknown): string | null {
  if (typeof raw === 'string') return raw;

  return typeof raw === 'number' || typeof raw === 'boolean' ? String(raw) : null;
}

function asNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;

  if (typeof raw !== 'string' || raw.trim() === '') return null;

  const parsed = Number(raw.trim());

  return Number.isFinite(parsed) ? parsed : null;
}

function inRange(value: number, field: TemplateField): Coerced {
  if (field.min !== undefined && value < field.min) return fail(`${value} is below the minimum ${field.min}`);

  if (field.max !== undefined && value > field.max) return fail(`${value} is above the maximum ${field.max}`);

  return { ok: true, value };
}

function clockSeconds(text: string): number | null {
  const trimmed = text.trim();

  if (!CLOCK.test(trimmed)) return asNumber(trimmed);

  return trimmed.split(':').reduce((total, part) => total * 60 + Number(part), 0);
}

function coerceText(raw: unknown, field: TemplateField): Coerced {
  const text = asText(raw);

  if (text === null) return fail('expected text');

  if (field.maxLength !== undefined && text.length > field.maxLength) {
    return fail(`${text.length} characters, more than maxLength ${field.maxLength}`);
  }

  return { ok: true, value: text };
}

function coerceNumber(raw: unknown, field: TemplateField): Coerced {
  const value = asNumber(raw);

  return value === null ? fail(`expected a number, got ${JSON.stringify(raw)}`) : inRange(value, field);
}

function coerceTime(raw: unknown, field: TemplateField): Coerced {
  const text = asText(raw);
  const seconds = text === null ? null : clockSeconds(text);

  if (seconds === null) return fail(`expected seconds or m:ss, got ${JSON.stringify(raw)}`);

  return seconds < 0 ? fail('a time cannot be negative') : inRange(seconds, field);
}

function coerceColor(raw: unknown): Coerced {
  const text = asText(raw)?.trim() ?? '';
  const valid = HEX_COLOR.test(text) || NAMED_COLOR.test(text) || FUNCTION_COLOR.test(text);

  return valid ? { ok: true, value: text } : fail(`expected a colour (#rrggbb, 0xrrggbb or a name), got "${text}"`);
}

function coerceUrl(raw: unknown): Coerced {
  const text = asText(raw)?.trim() ?? '';

  return ABSOLUTE_URL.test(text) ? { ok: true, value: text } : fail(`expected an absolute URL, got "${text}"`);
}

function coerceMedia(raw: unknown): Coerced {
  const text = asText(raw)?.trim() ?? '';

  return text !== '' && !/[\n\r]/.test(text) ? { ok: true, value: text } : fail('expected a media path or URL');
}

function coerceEnum(raw: unknown, field: TemplateField): Coerced {
  const text = asText(raw);
  const options = field.options ?? [];

  if (text !== null && options.includes(text)) return { ok: true, value: text };

  return fail(`expected one of ${options.join(', ')}, got ${JSON.stringify(raw)}`);
}

export const DEFAULT_FIELD_COERCERS: Record<FieldType, FieldCoercer> = {
  text: coerceText,
  color: coerceColor,
  url: coerceUrl,
  media: coerceMedia,
  number: coerceNumber,
  enum: coerceEnum,
  time: coerceTime,
};

export function coerceFieldValue(field: TemplateField, raw: unknown, coercers: FieldCoercers = {}): Coerced {
  const coerce = coercers[field.type] ?? DEFAULT_FIELD_COERCERS[field.type];

  return coerce(raw, field);
}

// A stand-in of the right type for a field with no value, used when validating without values (probe mode),
// so the rest of the template can still be checked. Null when the field's own placeholder string will do.
export function probeValue(field: TemplateField): FieldValue | null {
  if (field.type === 'number' || field.type === 'time') return field.min ?? field.max ?? 1;

  if (field.type === 'color') return '#000000';

  if (field.type === 'enum') return field.options?.[0] ?? null;

  return null;
}
