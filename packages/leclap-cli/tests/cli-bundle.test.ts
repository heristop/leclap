import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(here, '../dist/index.js');

interface CliResult {
  code: number;
  output: string;
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
          resolve({ code: 0, output });

          return;
        }

        resolve({ code: typeof error.code === 'number' ? error.code : 1, output });
      }
    );
  });
}

describe('CLI bundle (dist/index.js)', () => {
  it('compiles a template end-to-end without missing-method errors', async () => {
    const fixture = path.join(here, 'fixtures/cli-smoke.json');
    const { code, output } = await runCli([fixture]);

    expect(output).not.toMatch(/is not a function/);
    expect(output).toContain('Compilation completed successfully');
    expect(code).toBe(0);
  }, 90_000);
});
