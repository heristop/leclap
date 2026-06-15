import { TemplateDescriptorSchema, type TemplateDescriptor } from 'ffmpeg-video-composer';

// Derive the error type from the exported schema so this module needs no direct zod dependency.
type SafeParseResult = ReturnType<typeof TemplateDescriptorSchema.safeParse>;
type TemplateValidationError = Extract<SafeParseResult, { success: false }>['error'];

export type ValidationResult = { ok: true; descriptor: TemplateDescriptor } | { ok: false; message: string };

// Summarize the first three schema issues as `dotted.path: message`, capping the rest with a
// `(+N more)` suffix, so the full error tree (and any internal schema detail) never leaks to the
// agent.
function summarizeIssues(error: TemplateValidationError): string {
  const issues = error.issues.slice(0, 3).map((issue) => {
    const at = issue.path.length > 0 ? issue.path.join('.') : '(root)';

    return `${at}: ${issue.message}`;
  });
  const suffix = error.issues.length > 3 ? ` (+${error.issues.length - 3} more)` : '';

  return `Invalid template: ${issues.join('; ')}${suffix}`;
}

// Validate an untrusted, agent-supplied template object against the core descriptor schema at the
// tool boundary. Malformed input is rejected with a short message instead of reaching compile().
export function validateTemplate(raw: unknown): ValidationResult {
  const parsed = TemplateDescriptorSchema.safeParse(raw);

  if (!parsed.success) {
    return { ok: false, message: summarizeIssues(parsed.error) };
  }

  return { ok: true, descriptor: parsed.data };
}
