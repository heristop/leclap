import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TemplateDescriptorSchema } from 'ffmpeg-video-composer';
import { z } from 'zod';

// Short authoring guide prepended to the JSON Schema so an agent knows how to read it.
const GUIDE = [
  'Template authoring guide:',
  'A template has an optional top-level `global` (project-wide defaults) and an ordered `sections` ' +
    'array — each section becomes a clip and they are concatenated in order.',
  'Each section has a `name`, a `type` (video, project_video, form, color_background, ' +
    'image_background, music), optional `options`, and optional `filters`/`inputs`/`maps`.',
  'Strings may contain `{{ variables }}` (from global.variables), `{{ colorN }}` (1-indexed from ' +
    'colorsList), and `{{ form_field }}` placeholders, all resolved at compose time.',
  'project_video sections need user-supplied clips passed at compose time; the JSON Schema below is ' +
    'the authoritative shape.',
  'Start from a PREMIUM built-in (premium_intro, premium_quote, premium_titles, premium_reel_portrait, ' +
    'premium_quote_portrait) via get_template, then edit it — they already look professional and use ' +
    'only on-device-safe filters. Run validate_template (no render) to check edits before compose_video.',
].join('\n');

function describeSchema(): string {
  const jsonSchema = z.toJSONSchema(TemplateDescriptorSchema);

  return `${GUIDE}\n\nJSON Schema:\n${JSON.stringify(jsonSchema, null, 2)}`;
}

function fallbackText(): string {
  return `${GUIDE}\n\n(The machine-readable JSON Schema could not be generated. Use get_template to copy a working example, and consult docs/template-configuration.md for the full field reference.)`;
}

function buildText(): string {
  try {
    return describeSchema();
  } catch {
    return fallbackText();
  }
}

export function registerGetTemplateSchema(server: McpServer): void {
  server.registerTool(
    'get_template_schema',
    {
      title: 'Get Template Schema',
      description:
        'Return the JSON Schema for a template descriptor plus a short authoring guide. Use this to ' +
        'understand the full set of fields when building or editing a template for compose_video.',
    },
    () => ({
      content: [{ type: 'text', text: buildText() }],
    })
  );
}
