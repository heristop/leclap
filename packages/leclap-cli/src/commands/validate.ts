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

interface ValidationResult {
  success: boolean;
  errors?: ValidationError[];
}

// Pure: turn a validation result into display lines (no IO). On failure, one line per error plus a
// count; on success a single confirmation. ANSI styling is applied but picocolors honours NO_COLOR.
export function formatValidation(result: ValidationResult): string[] {
  if (result.success) {
    return [success('Template is valid')];
  }

  const errors = result.errors ?? [];

  if (errors.length === 0) {
    return [fail('Template is invalid')];
  }

  const lines = errors.map((e) => step(`${pc.red('✗')} ${pc.bold(e.path)} — ${e.message}`));

  return [fail(`Template is invalid (${errors.length} ${errors.length === 1 ? 'problem' : 'problems'})`), ...lines];
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

    if (!result.success) process.exit(1);
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

  return new TemplateValidator().validateTemplate(data) as ValidationResult;
}
