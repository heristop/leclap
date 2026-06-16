import { defineCommand } from 'citty';
import pc from 'picocolors';
import { FFmpegDetector, Terminal } from 'ffmpeg-video-composer';
import { printTitle, printBox } from '../ui.js';

export const diagnose = defineCommand({
  meta: { name: 'diagnose', description: 'Check your FFmpeg setup' },
  async run() {
    try {
      console.clear();
      printTitle('FFmpeg Diagnostics');

      const report = await FFmpegDetector.runFullDiagnostics(true);

      if (report.recommendations.length > 0) {
        const recommendationText = `
${pc.bold('🎯 Personalized Recommendations:')}

${report.recommendations.map((rec) => `  ${pc.cyan('•')} ${rec}`).join('\n')}
`;

        printBox(recommendationText, '💡 Suggestions');
      }

      const hasFFmpeg = [
        report.ffmpegStatus.system.available,
        report.ffmpegStatus.static.available,
        report.ffmpegStatus.wasm.available,
      ].some(Boolean);

      if (hasFFmpeg) {
        Terminal.showSuccess('Your system is ready for video magic! 🎉');
      }

      if (!hasFFmpeg) {
        console.log(`\n${pc.yellow('⚠️')} ${pc.bold('Setup required before you can compile videos')}\n`);
      }
    } catch (error) {
      console.error('Diagnostics failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },
});
