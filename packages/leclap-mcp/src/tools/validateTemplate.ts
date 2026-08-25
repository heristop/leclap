import type { McpServer } from '@modelcontextprotocol/server';
import {
  FilesystemNodeAdapter,
  PinoLogAdapter,
  TemplateValidator,
  createBundledFontLoader,
  type TemplateDescriptor,
  type TemplateDescriptorSchema,
} from 'ffmpeg-video-composer';
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

// The MCP server is a Node process with the engine's bundled fonts reachable, so it measures real
// glyph advances rather than the 0.5em-per-character estimate. Without this the agent-facing surface
// — the one authoring the most templates, with the least ability to eyeball a render — would see
// "(approx: font not staged)" on every line forever.
//
// Built once and its reads cached, because unlike the CLI this process is long-lived: an agent
// iterating on a descriptor calls validate_template dozens of times, and each call would otherwise
// re-stat and re-read the same ~700KB of TTFs for a tool that advertises itself as instant. The
// bundled set cannot change under a running server.
const fontBytes = new Map<string, Promise<Uint8Array | null>>();

function bundledFontLoader() {
  const load = createBundledFontLoader(new FilesystemNodeAdapter(new PinoLogAdapter()));

  return (file: string): Promise<Uint8Array | null> => {
    const cached = fontBytes.get(file);

    if (cached) {
      return cached;
    }

    const pending = load(file);

    fontBytes.set(file, pending);

    return pending;
  };
}

// One line per finding: path, message, and an `approx` marker when the measurement fell back to an
// estimate because the font was not staged. Returns undefined — not [] — when there is nothing to
// report, so the field disappears from the payload.
//
// Geometry is advisory, so it must not be able to fail the tool call: `handleValidate` is async now,
// and an unguarded throw here would turn a perfectly valid template into an MCP protocol error. The
// CLI guards the same call for the same reason (leclap-cli's `safeGeometryWarnings`).
export async function geometryLines(descriptor: TemplateDescriptor): Promise<string[] | undefined> {
  const warnings = await safeGeometryWarnings(descriptor);

  if (warnings.length === 0) {
    return undefined;
  }

  return warnings.map((w) => `${w.path}: ${w.message}${w.approx ? ' (approx: font not staged)' : ''}`);
}

async function safeGeometryWarnings(descriptor: TemplateDescriptor) {
  try {
    return await new TemplateValidator().getGeometryWarnings(
      descriptor as unknown as GeometryDescriptor,
      bundledFontLoader()
    );
  } catch (error) {
    // Every expected failure — no bundled fonts, an unreadable .ttf — is already handled inside the
    // loader and the parser, so anything landing here is a bug. Note it on stderr (stdout is the MCP
    // protocol channel) rather than letting a broken checker look like a clean template.
    process.stderr.write(`geometry checks skipped: ${error instanceof Error ? error.message : String(error)}\n`);

    return [];
  }
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
