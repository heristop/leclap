import { defineCommand } from 'citty';
import fs from 'node:fs/promises';
import pc from 'picocolors';
import { TemplateValidator } from 'ffmpeg-video-composer';
import { success, fail, step, hint } from '../ui.js';
import { wordmark } from '../theme.js';

// The validator returns this shape; kept local so the formatter is testable without importing engine
// internals. `path` points at the offending descriptor field.
interface ValidationError {
  path: string;
  message: string;
  code?: string;
}

interface ValidationWarning {
  path: string;
  message: string;
}

interface ValidationResult {
  success: boolean;
  errors?: ValidationError[];
  warnings?: ValidationWarning[];
}

// Pure: turn a validation result into display lines (no IO). On failure, one line per error plus a
// count; on success a single confirmation. Warnings are advisory — they render on both the success
// and failure paths and never affect which of those two paths is taken. ANSI styling is applied but
// picocolors honours NO_COLOR.
export function formatValidation(result: ValidationResult): string[] {
  const warnings = (result.warnings ?? []).map((w) => step(`${pc.yellow('!')} ${pc.bold(w.path)} — ${w.message}`));

  if (result.success) {
    return [success('Template is valid'), ...warnings];
  }

  const errors = result.errors ?? [];

  if (errors.length === 0) {
    return [fail('Template is invalid'), ...warnings];
  }

  const lines = errors.map((e) => step(`${pc.red('✗')} ${pc.bold(e.path)} — ${e.message}`));

  return [
    fail(`Template is invalid (${errors.length} ${errors.length === 1 ? 'problem' : 'problems'})`),
    ...lines,
    ...warnings,
  ];
}

// The exit code is driven solely by `success`; geometry (and any other) warnings must never flip it,
// or `leclap validate` stops being usable as a CI gate.
export function exitCodeFor(result: ValidationResult): number {
  return result.success ? 0 : 1;
}

async function loadJson(templatePath: string): Promise<unknown> {
  const raw = await fs.readFile(templatePath, 'utf8');

  return JSON.parse(raw);
}

export const validate = defineCommand({
  meta: { name: 'validate', description: 'Validate a template JSON without rendering' },
  args: {
    template: { type: 'positional', description: 'Path to a template JSON file', required: true },
    json: { type: 'boolean', description: 'Emit a machine-readable JSON result', default: false },
  },
  async run({ args }) {
    const json = args.json;

    const result = await runValidation(args.template, json);

    const output = json ? `${JSON.stringify(result)}\n` : `${formatValidation(result).join('\n')}\n`;
    process.stdout.write(output);

    const code = exitCodeFor(result);

    if (code !== 0) process.exit(code);
  },
});

// Load + validate, mapping a missing file or JSON syntax error into a structured result (so both the
// human and --json paths render it uniformly). Prints the wordmark only in the human path.
async function runValidation(templatePath: string, json: boolean): Promise<ValidationResult> {
  if (!json) process.stdout.write(wordmark());

  let data: unknown;

  try {
    data = await loadJson(templatePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (!json) console.log(hint(`  ${templatePath}`));

    return { success: false, errors: [{ path: templatePath, message, code: 'load_error' }] };
  }

  return attachGeometryWarnings(new TemplateValidator(), data);
}

// `validateTemplate`'s `data` is a `TemplateDescriptor | Section` union (shared with `validateSection`);
// only the descriptor shape carries `sections`, so `'type' in descriptor` (a Section-only field) tells
// them apart. Geometry checks only make sense for a full descriptor, and only run when the descriptor
// parsed — schema failures without `data` skip straight through. Warnings are advisory: they attach
// alongside whatever `success`/`errors` the schema validator produced and never change them (no font
// loader is passed, so measurements are approximate — a follow-up task wires a real one).
async function attachGeometryWarnings(validator: TemplateValidator, data: unknown): Promise<ValidationResult> {
  const result = validator.validateTemplate(data);
  const descriptor = result.data;

  if (!descriptor || 'type' in descriptor) {
    return result;
  }

  const warnings = await validator.getGeometryWarnings(descriptor);

  return { ...result, warnings: warnings.map((w) => ({ path: w.path, message: w.message })) };
}
