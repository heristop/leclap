import os from 'node:os';
import path from 'node:path';

// Runtime config for the MCP server. Precedence per field: CLI flag > env var > default.
// Dirs are resolved to absolute paths but never created here — the compose tool creates
// per-render output dirs on demand (Task 4).
export interface McpConfig {
  outputDir: string;
  mediaDir: string;
  renderTimeoutMs: number;
  /**
   * Enable the render_remotion_clip tool. It bundles and EXECUTES a caller-supplied Remotion entry
   * (arbitrary local JS) in headless Chromium, so it is an RCE surface unless the client is trusted.
   * Off by default; opt in with --allow-remotion / LECLAP_MCP_ALLOW_REMOTION for local design-time use.
   */
  allowRemotion: boolean;
  /** Default Remotion entry (the module that calls registerRoot) for render_remotion_clip; optional. */
  remotionEntry?: string;
}

const DEFAULT_RENDER_TIMEOUT_MS = 600_000;

// A boolean flag: present as a bare `--flag` (or `--flag=true`/`1`), else the env var when truthy.
// Self-contained (no positional readFlag lookup) so a bare `--flag` never swallows the next argv.
function readBoolean(argv: readonly string[], flag: string, envValue: string | undefined): boolean {
  if (argv.includes(flag)) {
    return true;
  }

  const inline = argv.find((arg) => arg.startsWith(`${flag}=`));

  if (inline !== undefined) {
    const value = inline.slice(flag.length + 1);

    return value === 'true' || value === '1';
  }

  return envValue === 'true' || envValue === '1';
}

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

  // Narrow default: confining reads to the whole home directory would let probe_media/compose_video
  // read any file under $HOME. Operators who keep media elsewhere set --media-dir / LECLAP_MCP_MEDIA_DIR.
  const mediaDir =
    readFlag(argv, '--media-dir') ?? process.env.LECLAP_MCP_MEDIA_DIR ?? path.join(os.homedir(), '.leclap', 'media');

  const renderTimeoutMs = resolveTimeout(
    readFlag(argv, '--render-timeout-ms') ?? process.env.LECLAP_MCP_RENDER_TIMEOUT_MS
  );

  const remotionEntry = readFlag(argv, '--remotion-entry') ?? process.env.LECLAP_MCP_REMOTION_ENTRY;
  const allowRemotion = readBoolean(argv, '--allow-remotion', process.env.LECLAP_MCP_ALLOW_REMOTION);

  return {
    outputDir: path.resolve(outputDir),
    mediaDir: path.resolve(mediaDir),
    renderTimeoutMs,
    allowRemotion,
    ...(remotionEntry ? { remotionEntry: path.resolve(remotionEntry) } : {}),
  };
}
