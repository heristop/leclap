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
export function validateTemplate(raw: unknown): ValidationResult {
  const validation = new TemplateValidator().validateTemplate(raw);

  if (!validation.success || !validation.data) {
    return { ok: false, message: summarizeErrors(validation.errors ?? []) };
  }

  // The engine types `data` as `TemplateDescriptor | Section` because the same result shape also
  // serves validateSection; validateTemplate only ever yields a descriptor.
  return { ok: true, descriptor: validation.data as TemplateDescriptor };
}
