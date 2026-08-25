import { defineCommand } from 'citty';
import fs from 'node:fs/promises';
import pc from 'picocolors';
import {
  TemplateValidator,
  FilesystemNodeAdapter,
  PinoLogAdapter,
  createBundledFontLoader,
  type GeometryWarning,
} from 'ffmpeg-video-composer';
import { success, fail, step, hint } from '../ui.js';
import { wordmark } from '../theme.js';

// The validator returns this shape; kept local so the formatter is testable without importing engine
// internals. `path` points at the offending descriptor field.
interface ValidationError {
  path: string;
  message: string;
  code?: string;
}

// Mirrors GeometryWarning wholesale (code/severity/approx included, not just path/message): a
// finding is only as trustworthy as the metrics behind it, and `approx` is the flag that says which
// kind it is. The `--json` path is documented to emit the field unchanged; dropping `approx` would
// print a confident pixel count for a number that was, in fact, guessed.
interface ValidationWarning {
  path: string;
  message: string;
  code?: string;
  severity?: string;
  approx?: boolean;
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
  const warnings = (result.warnings ?? []).map((w) => {
    const approx = w.approx ? ' (approx: font not staged)' : '';

    return step(`${pc.yellow('!')} ${pc.bold(w.path)} — ${w.message}${approx}`);
  });

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

    // `process.exitCode`, never `process.exit()`: writes to a pipe are asynchronous on POSIX, and
    // exiting outright discards whatever libuv has still queued. Piping `--json` into `jq` was
    // losing everything past the first pipe buffer — 64KB of a 600KB payload — which is exactly the
    // failing-template case that produces the most errors, and now also carries the warnings array.
    process.exitCode = exitCodeFor(result);
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

// A Node filesystem adapter, built directly rather than through the engine's tsyringe container: the
// container only registers `'logger'` inside `compile()`/`loadConfig()`, neither of which `validate`
// calls, so `container.resolve(FilesystemNodeAdapter)` would throw here. `@inject('logger')` only
// matters when tsyringe itself constructs the class; a plain `new` with a logger instance satisfies
// the constructor without the container. Its `resolveBundledFont`/`readFile` never call the logger,
// so a bare `PinoLogAdapter` (no engine log-level wiring needed) is enough.
function bundledFontLoader() {
  return createBundledFontLoader(new FilesystemNodeAdapter(new PinoLogAdapter()));
}

// `validateTemplate`'s `data` is a `TemplateDescriptor | Section` union (shared with `validateSection`);
// only the descriptor shape carries `sections`, so `'type' in descriptor` (a Section-only field) tells
// them apart. Geometry checks only make sense for a full descriptor, and only run when the descriptor
// parsed — schema failures without `data` skip straight through. Warnings are advisory: they attach
// alongside whatever `success`/`errors` the schema validator produced and never change them. The font
// loader degrades to `null` per font (no bundled fonts found, e.g. a published install) rather than
// throwing, so a miss falls back to approximate measurement instead of breaking validation.
async function attachGeometryWarnings(validator: TemplateValidator, data: unknown): Promise<ValidationResult> {
  const result = validator.validateTemplate(data);
  const descriptor = result.data;

  if (!descriptor || 'type' in descriptor) {
    return result;
  }

  const warnings = await safeGeometryWarnings(validator, descriptor);

  // Absent, not empty: a clean template must not emit `"warnings":[]` — that is the zero-token
  // guarantee, and it only holds if the key itself disappears.
  if (warnings.length === 0) {
    return result;
  }

  // Passed through wholesale (code/severity/approx included): `--json` is documented to emit
  // whatever `getGeometryWarnings` returned, unreshaped.
  return { ...result, warnings };
}

// Advisory findings must never take the exit code hostage. `bundledFontLoader()` and
// `getGeometryWarnings` both run here so a throw from either — a missing platform dependency, a
// font that fails to parse — degrades to "no warnings" instead of crashing an otherwise valid
// template.
async function safeGeometryWarnings(
  validator: TemplateValidator,
  descriptor: Parameters<TemplateValidator['getGeometryWarnings']>[0]
): Promise<GeometryWarning[]> {
  try {
    return await validator.getGeometryWarnings(descriptor, bundledFontLoader());
  } catch (error) {
    // Degrade, but not in silence. Every *expected* failure — no bundled fonts, an unreadable .ttf —
    // is already handled inside the loader and the parser, so anything arriving here is a bug, and
    // swallowing it outright makes a broken checker indistinguishable from a clean template. stderr,
    // so `--json` on stdout stays parseable.
    process.stderr.write(`geometry checks skipped: ${error instanceof Error ? error.message : String(error)}\n`);

    return [];
  }
}
