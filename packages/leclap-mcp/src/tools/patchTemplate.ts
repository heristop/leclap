import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { validateTemplate } from '../compose/validation.js';
import { templateRevision } from '../effects/template-revision.js';

const editSchema = z
  .object({
    section: z.string().min(1),
    props: z.record(z.string(), z.json()),
  })
  .strict();
const inputSchema = z
  .object({
    template: z.record(z.string(), z.json()),
    expectedRevision: z.string(),
    edits: z.array(editSchema).min(1),
  })
  .strict();
type PatchArgs = z.infer<typeof inputSchema>;

type EffectValidator = (template: Record<string, unknown>) => void | Promise<void>;

type JsonObject = Record<string, z.infer<ReturnType<typeof z.json>>>;

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function applyEdit(sections: unknown[], edit: z.infer<typeof editSchema>, seen: Set<string>): void {
  const matches = sections.filter((section) => isObject(section) && section.name === edit.section);

  if (matches.length > 1) {
    throw new Error(`Ambiguous section name: ${edit.section}`);
  }
  const section = matches[0];

  if (!isObject(section) || section.type !== 'effect') {
    throw new Error(`Unknown effect section: ${edit.section}`);
  }
  const effect = section.effect;

  if (!isObject(effect)) {
    throw new Error(`Invalid effect reference: ${edit.section}`);
  }

  for (const property of Object.keys(edit.props)) {
    const key = `${edit.section}\0${property}`;

    if (seen.has(key)) {
      throw new Error(`Duplicate property edit: ${edit.section}.${property}`);
    }
    seen.add(key);
  }
  effect.props = { ...(isObject(effect.props) ? effect.props : {}), ...edit.props };
}

/** Apply a complete edit batch to a copy. A conflict or invalid edit never changes caller state. */
export function patchTemplate(input: unknown) {
  const args = inputSchema.parse(input);

  if (templateRevision(args.template) !== args.expectedRevision) {
    throw new Error('revision_conflict: template changed; use the revision returned by validate_template.');
  }
  const template = structuredClone(args.template);
  const sections = template.sections;

  if (!Array.isArray(sections)) {
    throw new Error('Template sections must be an array.');
  }
  const seen = new Set<string>();

  for (const edit of args.edits) {
    applyEdit(sections, edit, seen);
  }
  const validated = validateTemplate(template);

  if (!validated.ok) {
    throw new Error(validated.message);
  }

  return {
    template,
    revision: templateRevision(template),
    changedSections: [...new Set(args.edits.map((edit) => edit.section))],
  };
}

export function registerPatchTemplate(server: McpServer, validateEffects?: EffectValidator): void {
  server.registerTool(
    'patch_template',
    {
      title: 'Patch Template',
      description:
        'Atomically replace selected props of named effect sections in inline JSON. Pass the expected revision from validate_template. Returns updated JSON and revision; never rewrites effect source.',
      inputSchema,
    },
    async (args: PatchArgs) => {
      try {
        const result = patchTemplate(args);
        await validateEffects?.(result.template);

        return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: error instanceof Error ? error.message : String(error) }],
        };
      }
    }
  );
}
