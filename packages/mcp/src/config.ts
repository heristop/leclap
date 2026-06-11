import os from 'node:os';
import path from 'node:path';

// Runtime config for the MCP server. Precedence per field: CLI flag > env var > default.
// Dirs are resolved to absolute paths but never created here — the compose tool creates
// per-render output dirs on demand (Task 4).
export interface McpConfig {
  outputDir: string;
  mediaDir: string;
  renderTimeoutMs: number;
}

const DEFAULT_RENDER_TIMEOUT_MS = 600_000;

// Minimal `--flag value` parser — no new dep. Returns the value following the flag, or
// undefined when absent. Supports both `--flag value` and `--flag=value`.
function readFlag(argv: readonly string[], flag: string): string | undefined {
  const prefix = `${flag}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));

  if (inline !== undefined) {
    return inline.slice(prefix.length);
  }

  const index = argv.indexOf(flag);

  if (index === -1) {
    return undefined;
  }

  return argv[index + 1];
}

function resolveTimeout(raw: string | undefined): number {
  if (raw === undefined) {
    return DEFAULT_RENDER_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(raw, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_RENDER_TIMEOUT_MS;
  }

  return parsed;
}

export function loadConfig(argv: readonly string[] = process.argv): McpConfig {
  const outputDir =
    readFlag(argv, '--output-dir') ??
    process.env.LECLAP_MCP_OUTPUT_DIR ??
    path.join(os.homedir(), '.leclap', 'renders');

  const mediaDir = readFlag(argv, '--media-dir') ?? process.env.LECLAP_MCP_MEDIA_DIR ?? os.homedir();

  const renderTimeoutMs = resolveTimeout(
    readFlag(argv, '--render-timeout-ms') ?? process.env.LECLAP_MCP_RENDER_TIMEOUT_MS
  );

  return {
    outputDir: path.resolve(outputDir),
    mediaDir: path.resolve(mediaDir),
    renderTimeoutMs,
  };
}
