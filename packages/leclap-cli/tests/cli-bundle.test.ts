import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(here, '../dist/index.js');

interface CliResult {
  code: number;
  output: string;
  stdout: string;
}

// Run the BUILT dist/index.js as a real subprocess (resolves even on non-zero exit so the test
// asserts on output). Catches a bundle that drifted from source — e.g. a class method the core's
// dist never emitted — which mocked unit tests can't see. Requires `pnpm build` first.
function runCli(args: string[]): Promise<CliResult> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [CLI, ...args],
      { cwd: here, timeout: 90_000, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const output = `${stdout}${stderr}`;

        if (error === null) {
          resolve({ code: 0, output, stdout });

          return;
        }

        resolve({ code: typeof error.code === 'number' ? error.code : 1, output, stdout });
      }
    );
  });
}

describe('CLI bundle (dist/index.js)', () => {
  it('renders a template end-to-end via the `render` subcommand', async () => {
    const fixture = path.join(here, 'fixtures/cli-smoke.json');
    const { code, output } = await runCli(['render', fixture]);

    expect(output).not.toMatch(/is not a function/);
    expect(output).not.toMatch(/"level":\d+/); // engine JSON logs are silenced
    expect(output).toContain('Rendered');
    expect(code).toBe(0);
  }, 90_000);

  // An unknown filter type is schema-valid (filter types reach FFmpeg verbatim), so the failure happens
  // while the engine renders the segment — the case that used to come back as a bare
  // "Compilation failed to produce output".
  it('reports why the engine failed in the --json error', async () => {
    const fixture = path.join(here, 'fixtures/unknown-filter.json');
    const { code, stdout } = await runCli(['render', fixture, '--json']);
    const result = JSON.parse(stdout) as { ok: boolean; error: string };

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/^FFmpeg command failed/);
    expect(result.error).toContain('definitelynotafilter');
    expect(code).toBe(1);
  }, 90_000);
});
