import type { McpServer } from '@modelcontextprotocol/server';
import { TemplateValidator, type TemplateDescriptor, type TemplateDescriptorSchema } from 'ffmpeg-video-composer';
import { z } from 'zod';

import { validateTemplate } from '../compose/validation.js';

const inputSchema = z.object({
  template: z.record(z.string(), z.unknown()),
});

const outputSchema = z.object({
  valid: z.boolean(),
  sectionCount: z.number(),
  orientation: z.string().nullable(),
  requiredClips: z.array(z.string()),
  formFields: z.array(z.string()),
  // Present only when there is something to say. A clean template omits the field rather than
  // sending an empty array — the agent pays for every key it reads.
  geometry: z
    .array(z.string())
    .optional()
    .describe(
      'Text that would overflow the frame, collide with other text, or render too small to read — ' +
        'one line per finding, present only when there is something to fix; check this before rendering.'
    ),
});

type ValidateArgs = { template: Record<string, unknown> };
type ToolError = { isError: true; content: [{ type: 'text'; text: string }] };
type DescriptorResult = { ok: true; descriptor: TemplateDescriptor } | ToolError;

function errorResult(text: string): ToolError {
  return { isError: true, content: [{ type: 'text', text }] };
}

// Schema-validate the inline descriptor against the core schema.
function resolveDescriptor(args: ValidateArgs): DescriptorResult {
  const result = validateTemplate(args.template);

  if (!result.ok) {
    return errorResult(result.message);
  }

  return { ok: true, descriptor: result.descriptor };
}

// The clips compose_video will require (one per project_video section, keyed by section name).
function requiredClips(descriptor: TemplateDescriptor): string[] {
  return (descriptor.sections ?? [])
    .filter((section) => section.type === 'project_video' && typeof section.name === 'string')
    .map((section) => section.name as string);
}

// The form field names the template collects — what compose_video expects in `fields`.
function formFields(descriptor: TemplateDescriptor): string[] {
  return (descriptor.sections ?? [])
    .filter((section) => section.type === 'form')
    .flatMap((section) => section.options?.fields ?? [])
    .map((field) => field.name);
}

// `descriptor` reaches this function via `compose/validation.ts`'s `validateTemplate()`, which parses
// the raw input with `TemplateDescriptorSchema` and then casts that zod-shaped result to the public
// `TemplateDescriptor` (core/types) to satisfy its own return type. So at runtime the value was never
// actually the public interface shape — it is (and always was) the zod-inferred shape. This cast just
// names that reality so it type-checks here too. It is NOT the same cast as the one in validation.ts:
// that one goes the opposite direction and exists to satisfy `ValidationResult.data`'s type; this one
// undoes it. Safe because `getGeometryWarnings`'s consumers (collectGeometryWarnings, text-boxes.ts)
// only read fields off the object — they never re-parse it — so the zod type's extra optional fields
// (e.g. `partials`) are simply absent/inert, never a problem.
type GeometryDescriptor = z.infer<typeof TemplateDescriptorSchema>;

// One line per finding: path, message, and an `approx` marker when the measurement fell back to an
// estimate because the font was not staged. Returns undefined — not [] — when there is nothing to
// report, so the field disappears from the payload.
export async function geometryLines(descriptor: TemplateDescriptor): Promise<string[] | undefined> {
  const warnings = await new TemplateValidator().getGeometryWarnings(descriptor as unknown as GeometryDescriptor);

  if (warnings.length === 0) {
    return undefined;
  }

  return warnings.map((w) => `${w.path}: ${w.message}${w.approx ? ' (approx: font not staged)' : ''}`);
}

async function summary(descriptor: TemplateDescriptor) {
  const sectionCount = descriptor.sections?.length ?? 0;
  const orientation = descriptor.global?.orientation ?? null;
  const clips = requiredClips(descriptor);
  const fields = formFields(descriptor);
  const geometry = await geometryLines(descriptor);
  const needs = [
    clips.length > 0 ? `clips: ${clips.join(', ')}` : 'no clips',
    fields.length > 0 ? `fields: ${fields.join(', ')}` : 'no fields',
  ].join('; ');

  return {
    content: [
      {
        type: 'text' as const,
        text: `Valid template — ${sectionCount} section(s), ${orientation ?? 'default'} orientation. Requires ${needs}.`,
      },
    ],
    structuredContent: {
      valid: true,
      sectionCount,
      orientation,
      requiredClips: clips,
      formFields: fields,
      geometry,
    },
  };
}

async function handleValidate(args: ValidateArgs) {
  const resolved = resolveDescriptor(args);

  if ('isError' in resolved) {
    return resolved;
  }

  return summary(resolved.descriptor);
}

export function registerValidateTemplate(server: McpServer): void {
  server.registerTool(
    'validate_template',
    {
      title: 'Validate Template',
      description:
        'Dry-run an inline `template` descriptor against the core schema WITHOUT rendering — returns ' +
        'instantly. Get back whether it is valid plus what compose_video will require: the ' +
        'project_video clip sections and the form fields. Use this to iterate on a descriptor in ' +
        'milliseconds before the slower compose_video render. Also catches, render-free, text that ' +
        'overflows the frame, collides with other text, or is too small to read — see the `geometry` ' +
        'field.',
      inputSchema,
      outputSchema,
    },
    (args: ValidateArgs) => handleValidate(args)
  );
}
