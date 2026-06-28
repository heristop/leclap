import { defineCommand } from 'citty';
import pc from 'picocolors';
import { FFmpegDetector } from 'ffmpeg-video-composer';
import { fail, hint, step } from '../ui.js';
import { wordmark, statusRow, ok, dot } from '../theme.js';

type ImplStatus = { available: boolean; version?: string };

// One uniform presentation per backend: green ✓ when present, a dim ✗ when not — availability is the
// only thing colour encodes. (The engine's own diagnostics paint each backend a different hue; we
// suppress that and render our own calm, aligned row instead.)
function impl(name: string, status: ImplStatus): string {
  if (!status.available) return pc.dim(`✗ ${name}`);

  return `${ok} ${name} ${pc.dim(status.version ?? '')}`.trimEnd();
}

export const diagnose = defineCommand({
  meta: { name: 'diagnose', description: 'Check your FFmpeg setup' },
  async run() {
    try {
      process.stdout.write(wordmark());

      const report = await FFmpegDetector.runFullDiagnostics(false);
      const sys = report.systemInfo;
      const ff = report.ffmpegStatus;

      // `systemInfo.os` already carries the arch (e.g. "darwin arm64"), so don't append it again.
      console.log(statusRow('system', pc.dim(`${sys.os}  ${dot}  node ${sys.nodeVersion}  ${dot}  ${sys.memoryGB}GB`)));
      console.log(
        statusRow(
          'ffmpeg',
          [impl('system', ff.system), impl('static', ff.static), impl('wasm', ff.wasm)].join(`  ${dot}  `)
        )
      );
      console.log('');

      if (report.recommendations.length > 0) {
        console.log(hint('Suggestions'));
        // The engine prefixes recommendations with decorative emoji; strip a leading symbol so they sit
        // cleanly under the `›` marker in the refined layout.
        for (const rec of report.recommendations) console.log(step(rec.replace(/^[^\p{L}\p{N}]+/u, '')));
        console.log('');
      }

      const ready = ff.system.available || ff.static.available || ff.wasm.available;

      if (ready) {
        console.log(`${ok} ${pc.bold('Ready to render.')}`);

        return;
      }

      console.log(fail('Setup required before you can render.'));
    } catch (error) {
      console.error(fail(`Diagnostics failed: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  },
});
