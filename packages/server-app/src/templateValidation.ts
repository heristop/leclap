import { TemplateDescriptorSchema, type TemplateDescriptor } from 'ffmpeg-video-composer';
import type { CompileOutcome, VideoFile } from './compile.js';

// Derive the error type straight from the exported schema so the server stays free of a
// direct zod dependency.
type SafeParseResult = ReturnType<typeof TemplateDescriptorSchema.safeParse>;
type TemplateValidationError = Extract<SafeParseResult, { success: false }>['error'];

export interface ValidationSuccess {
  ok: true;
  descriptor: TemplateDescriptor;
}

export interface ValidationFailure {
  ok: false;
  outcome: CompileOutcome;
}

// Summarize the first few schema issues into a short, client-safe message. We deliberately
// avoid serializing the full error tree so internal schema shape / stack details don't leak.
function summarizeValidationError(error: TemplateValidationError): string {
  const issues = error.issues.slice(0, 3).map((issue) => {
    const at = issue.path.length > 0 ? issue.path.join('.') : '(root)';

    return `${at}: ${issue.message}`;
  });
  const suffix = error.issues.length > 3 ? ` (+${error.issues.length - 3} more)` : '';

  return `Invalid template: ${issues.join('; ')}${suffix}`;
}

function fail(errorMessage: string): ValidationFailure {
  return { ok: false, outcome: { success: false, outputPath: null, errorMessage, statusCode: 400 } };
}

// Reject the request unless the template is present, structurally valid, and any required
// uploads were provided. Returns the parsed descriptor on success or a failure outcome.
export function validateCompileRequest(
  templateJson: unknown,
  videoFiles: VideoFile[]
): ValidationSuccess | ValidationFailure {
  if (!templateJson) {
    return fail('Template JSON missing in request');
  }

  // Validate the untrusted template against the core schema at the boundary so malformed
  // input is rejected with a clean 400 instead of reaching the compilation engine.
  const parsed = TemplateDescriptorSchema.safeParse(templateJson);

  if (!parsed.success) {
    return fail(summarizeValidationError(parsed.error));
  }

  // Only templates with `project_video` sections need user-recorded clips. Templates built
  // solely from color backgrounds / text / pictures compile without any upload, so don't
  // reject those for having no files.
  const sections = parsed.data.sections ?? [];
  const requiresVideoUpload = sections.some((s) => s.type === 'project_video');

  if (requiresVideoUpload && videoFiles.length === 0) {
    return fail('No video files uploaded');
  }

  // parsed.data has passed schema validation. The core's hand-written TemplateDescriptor is
  // a slightly stricter view of the same shape (e.g. it marks Input.url required), so a single
  // narrowing here keeps the rest of the pipeline typed without re-asserting raw, unvalidated
  // JSON the way the previous `templateJson as TemplateDescriptor` cast did.
  return { ok: true, descriptor: parsed.data as TemplateDescriptor };
}
