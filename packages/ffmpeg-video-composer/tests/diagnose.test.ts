import { describe, it, expect } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

describe('Diagnose Script', () => {
  it('should run diagnose script without reflect-metadata errors', async () => {
    // Run the diagnose script
    const { stdout, stderr } = await execAsync('node diagnose.js', {
      cwd: PROJECT_ROOT,
      timeout: 30000,
    });

    // Check that there are no reflect-metadata errors
    expect(stderr).not.toContain('tsyringe requires a reflect polyfill');
    expect(stderr).not.toContain('reflect-metadata');

    // Check that the script produces output
    expect(stdout).toBeTruthy();
    // The output contains ASCII art title, check for key text
    const hasRelevantOutput =
      stdout.includes('FFmpeg') || stdout.includes('Diagnostics') || stdout.includes('Video Composer');
    expect(hasRelevantOutput).toBe(true);
  }, 30000);

  it('should complete successfully when FFmpeg is available', async () => {
    try {
      const { stdout, stderr } = await execAsync('node diagnose.js', {
        cwd: PROJECT_ROOT,
        timeout: 30000,
      });

      // Should not have critical errors
      expect(stderr).not.toContain('Error:');
      // Check for successful output indicators
      const hasOutput = stdout.includes('FFmpeg') || stdout.includes('Video Composer');
      expect(hasOutput).toBe(true);

      // Should show at least one FFmpeg implementation
      const hasSystemFFmpeg = stdout.includes('System FFmpeg') || stdout.includes('system');
      const hasStaticFFmpeg = stdout.includes('Static FFmpeg') || stdout.includes('ffmpeg-static');
      const hasWasmFFmpeg = stdout.includes('WebAssembly') || stdout.includes('wasm');

      expect(hasSystemFFmpeg || hasStaticFFmpeg || hasWasmFFmpeg).toBe(true);
    } catch (error) {
      // If the script fails, it should be with a clear error message
      // not a reflect-metadata error
      if (error instanceof Error && 'stderr' in error) {
        expect((error as any).stderr).not.toContain('reflect-metadata');
      }

      throw error;
    }
  }, 30000);

  it('should import reflect-metadata at the top of the file', async () => {
    const { readFile } = await import('node:fs/promises');
    const diagnoseContent = await readFile(path.join(PROJECT_ROOT, 'diagnose.js'), 'utf-8');

    // Check that reflect-metadata is imported
    expect(diagnoseContent).toContain("import 'reflect-metadata'");

    // Check that it's imported before other imports
    const lines = diagnoseContent.split('\n');
    let foundReflectMetadata = false;
    let foundOtherImports = false;

    for (const line of lines) {
      if (line.trim().startsWith("import 'reflect-metadata'")) {
        foundReflectMetadata = true;

        continue;
      }

      if (line.trim().startsWith('import') && !line.includes('reflect-metadata') && line.includes('from')) {
        if (foundReflectMetadata) {
          // This is fine - reflect-metadata is imported before this
          continue;
        }

        foundOtherImports = true;
      }
    }

    expect(foundReflectMetadata).toBe(true);
    expect(foundOtherImports).toBe(false); // No imports should come before reflect-metadata
  });
});
