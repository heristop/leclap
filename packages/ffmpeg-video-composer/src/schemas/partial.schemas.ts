import { z } from 'zod';

// A reusable section fragment expanded into a template via `{ type: "partial", ref }` before
// validation/compilation. `sections` are kept loose (`z.unknown()`) here — they are validated as real
// sections once inlined. Kept in its own module so the root descriptor schema stays under max-lines.
export const TemplatePartialSchema = z
  .object({
    id: z.string().describe('Stable id referenced by `{ type: "partial", ref }` sections.'),
    description: z.string().optional().describe('Short human-readable summary of the partial.'),
    variables: z.record(z.string(), z.string()).optional().describe('Default `{{ key }}` values, overridden per ref.'),
    sections: z.array(z.unknown()).describe('The real sections this partial expands into (validated once inlined).'),
  })
  .describe('A reusable section fragment expanded into a template via `{ type: "partial", ref }`.');
