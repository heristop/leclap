import { defineCommand } from 'citty';
import pc from 'picocolors';
import { FFmpegDetector } from 'ffmpeg-video-composer';
import { fail, hint, step } from '../ui.js';
import { wordmark, statusRow, ok, dot } from '../theme.js';

// `ffprobe` is only reported for static: false when ffmpeg-static has no ffprobe to probe media with.
type ImplStatus = { available: boolean; version?: string; ffprobe?: boolean };

type FFmpegStatus = { system: ImplStatus; static: ImplStatus; wasm: ImplStatus };

// One uniform presentation per backend: green ✓ when present, a dim ✗ when not — availability is the
// only thing colour encodes. (The engine's own diagnostics paint each backend a different hue; we
// suppress that and render our own calm, aligned row instead.)
function impl(name: string, status: ImplStatus): string {
  if (!status.available) return pc.dim(`✗ ${name}`);

  const backend = `${ok} ${name} ${pc.dim(status.version ?? '')}`.trimEnd();

  if (status.ffprobe === false) return `${backend} ${pc.dim('(no ffprobe)')}`;

  return backend;
}

// Renders run on system FFmpeg, else on ffmpeg-static — which, without an ffprobe, can't probe media,
// so templates with transitions, music, whole-video overlays or video clips stop before encoding.
function verdict(ff: FFmpegStatus): string {
  if (!ff.system.available && ff.static.available && ff.static.ffprobe === false) {
    return fail('Setup required for templates with transitions, music, overlays or video clips.');
  }

  if (ff.system.available || ff.static.available || ff.wasm.available) return `${ok} ${pc.bold('Ready to render.')}`;

  return fail('Setup required before you can render.');
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

      console.log(verdict(ff));
    } catch (error) {
      console.error(fail(`Diagnostics failed: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  },
});
