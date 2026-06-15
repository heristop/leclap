import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TemplateDescriptorSchema } from 'ffmpeg-video-composer';
import { z } from 'zod';

// Short authoring guide prepended to the JSON Schema so an agent knows how to read it.
const GUIDE = [
  'Template authoring guide:',
  'A template has an optional top-level `global` (project-wide defaults) and an ordered `sections` ' +
    'array — each section becomes a clip and they are composed in order.',
  'Each section has a `name`, a `type` (video, project_video, form, color_background, ' +
    'image_background, music), optional `options`, and optional `filters`/`inputs`/`maps`.',
  'All durations are in SECONDS (options.duration, transition.duration, audioFade durations, etc.).',
  'A structured-sugar layer sits above raw filters (prefer it over raw filters): `transition` ({type: an xfade name ' +
    'or "cut", duration?}) on global and/or per section; `look` (cinematic/warm/cool/vintage/noir/' +
    'vivid/dreamy) and `grade` (brightness/contrast/saturation/gamma/hue/colorBalance/blur); `motion` ' +
    '(kenburns [image_background only], rotate, crop, flip); audio polish via global.audio ' +
    '(sourceVolume, musicVolume, normalize, ducking) and options.audioFade; color_background `layers`; ' +
    'and project_video `framingGuide` (a recording-UI overlay, never rendered). They compile to ' +
    'ordinary on-device-safe FFmpeg filters. `filters[]` remains the raw escape hatch (FFmpeg-native keys).',
  'Note: any non-"cut" transition triggers a full-timeline re-encode (costly on WASM/on-device); ' +
    'cut-only templates use a fast stream-copy concat.',
  'Strings may contain `{{ variables }}` (from global.variables), `{{ colorN }}` (1-indexed from ' +
    'colorsList), and `{{ form_field }}` placeholders, all resolved at compose time.',
  'project_video sections need user-supplied clips passed at compose time; the JSON Schema below is ' +
    'the authoritative shape.',
  'Start from a built-in (intro, fast-curious, landscape-spotlight, portrait-spotlight) via ' +
    'get_template, then edit it — they already look professional and use only on-device-safe filters. ' +
    'Run validate_template (no render) to check edits before compose_video.',
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
