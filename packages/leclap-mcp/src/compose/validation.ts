import { TemplateValidator, type TemplateDescriptor, type ValidationError } from 'ffmpeg-video-composer';

export type ValidationResult = { ok: true; descriptor: TemplateDescriptor } | { ok: false; message: string };

// Summarize the first three issues as `dotted.path: message`, capping the rest with a
// `(+N more)` suffix, so the full error tree (and any internal validator detail) never leaks to the
// agent.
function summarizeErrors(errors: ValidationError[]): string {
  const issues = errors.slice(0, 3).map((error) => `${error.path || '(root)'}: ${error.message}`);
  const suffix = errors.length > 3 ? ` (+${errors.length - 3} more)` : '';

  return `Invalid template: ${issues.join('; ')}${suffix}`;
}

// Validate an untrusted, agent-supplied template object with the SAME TemplateValidator the engine's
// compile gate runs — the Zod schema plus the descriptor rules (section references, transitions,
// motion, global animations, watermark, fonts) — so validate_template can never bless a template
// that compile() would reject mid-render. The validator expands `{type:'partial'}` sections first
// and the descriptor returned here carries those REAL sections, which keeps a project_video living
// inside a partial visible to the clip-coverage checks.
// Check authored effect keys before core Zod records can strip __proto__.
function objectRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}
export function unsafeEffectValue(values: unknown[]): string | undefined {
  const pending = values.map((value) => ({ value, depth: 0 }));
  let visited = 0;

  while (pending.length > 0) {
    const next = pending.pop();

    if (!next) break;

    if (++visited > 20000 || next.depth > 64) return 'effect_key_unsafe: effect JSON exceeds traversal bounds.';
    const record = objectRecord(next.value);

    if (!record) continue;

    for (const key of Object.keys(record)) {
      if (key in Object.prototype || key === 'prototype') return `effect_key_unsafe: reserved effect key ${key}.`;
      pending.push({ value: record[key], depth: next.depth + 1 });
    }
  }

  return undefined;
}
export function effectKeyError(raw: unknown): string | undefined {
  const template = objectRecord(raw);

  if (!template) return undefined;
  const partials = Array.isArray(template.partials) ? template.partials : [];
  const groups = [template.sections, ...partials.map((partial) => objectRecord(partial)?.sections)];
  const values = groups
    .flatMap((group) => (Array.isArray(group) ? group : []))
    .flatMap((section) => {
      const record = objectRecord(section);

      if (record?.type !== 'effect') return [];
      const effect = objectRecord(record.effect);

      return [effect?.props, effect?.assets];
    });

  return unsafeEffectValue(values);
}
export function validateTemplate(raw: unknown): ValidationResult {
  const keyError = effectKeyError(raw);

  if (keyError) return { ok: false, message: keyError };
  const validation = new TemplateValidator().validateTemplate(raw);

  if (!validation.success || !validation.data) {
    return { ok: false, message: summarizeErrors(validation.errors ?? []) };
  }

  // The engine types `data` as `TemplateDescriptor | Section` because the same result shape also
  // serves validateSection; validateTemplate only ever yields a descriptor.
  return { ok: true, descriptor: validation.data as TemplateDescriptor };
}
