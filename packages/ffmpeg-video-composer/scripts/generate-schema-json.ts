import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { templateDescriptorJsonSchema } from '../src/schemas/template.schemas';

// Regenerates the machine-readable JSON Schema for a template descriptor from the zod source
// (`templateDescriptorJsonSchema`, i.e. z.toJSONSchema(TemplateDescriptorSchema)) and writes it to
// docs/. Re-run after editing any schema in src/schemas/. Invoked via `pnpm generate:schema`.

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');
const outFile = resolve(repoRoot, 'docs/template-descriptor.schema.json');

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, `${JSON.stringify(templateDescriptorJsonSchema, null, 2)}\n`, 'utf8');

console.log(`Wrote ${outFile}`);
