import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TemplateDescriptor } from 'ffmpeg-video-composer';
import { z } from 'zod';

import { validateTemplate } from '../compose/validation.js';

const inputShape = {
  template: z.record(z.string(), z.unknown()),
};

const outputShape = {
  valid: z.boolean(),
  sectionCount: z.number(),
  orientation: z.string().nullable(),
  requiredClips: z.array(z.string()),
  formFields: z.array(z.string()),
};

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

function summary(descriptor: TemplateDescriptor) {
  const sectionCount = descriptor.sections?.length ?? 0;
  const orientation = descriptor.global?.orientation ?? null;
  const clips = requiredClips(descriptor);
  const fields = formFields(descriptor);
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
    },
  };
}

function handleValidate(args: ValidateArgs) {
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
        'milliseconds before the slower compose_video render.',
      inputSchema: inputShape,
      outputSchema: outputShape,
    },
    (args: ValidateArgs) => handleValidate(args)
  );
}
