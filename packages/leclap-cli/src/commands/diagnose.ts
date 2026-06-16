import { defineCommand } from 'citty';
import { FFmpegDetector, Terminal } from 'ffmpeg-video-composer';
import { heading, fail, step, hint } from '../ui.js';

export const diagnose = defineCommand({
  meta: { name: 'diagnose', description: 'Check your FFmpeg setup' },
  async run() {
    try {
      console.log(`\n${heading('FFmpeg diagnostics')}\n`);

      const report = await FFmpegDetector.runFullDiagnostics(true);

      if (report.recommendations.length > 0) {
        console.log(`\n${hint('Suggestions')}`);

        for (const rec of report.recommendations) {
          console.log(step(rec));
        }
      }

      const hasFFmpeg = [
        report.ffmpegStatus.system.available,
        report.ffmpegStatus.static.available,
        report.ffmpegStatus.wasm.available,
      ].some(Boolean);

      console.log('');

      if (hasFFmpeg) {
        Terminal.showSuccess('Ready to render.');
      }

      if (!hasFFmpeg) {
        console.log(fail('Setup required before you can render.'));
      }
    } catch (error) {
      console.error(fail(`Diagnostics failed: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  },
});
