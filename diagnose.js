#!/usr/bin/env node

// Standalone diagnose script that uses the built version
// This avoids TypeScript path resolution issues

import { FFmpegDetector, TerminalUI } from './dist/index.js';

async function runDiagnostics() {
  try {
    console.clear();
    console.log(TerminalUI.createTitle('FFmpeg Diagnostics'));

    const report = await FFmpegDetector.runFullDiagnostics(true);

    // Show recommendations
    if (report.recommendations.length > 0) {
      const recommendationText = `
🎯 Personalized Recommendations:

${report.recommendations.map(rec => `  • ${rec}`).join('\n')}
`;

      console.log(TerminalUI.createBox(recommendationText, '💡 Smart Suggestions', 'info'));
    }

    // Show summary
    const hasFFmpeg = report.ffmpegStatus.system.available ||
                     report.ffmpegStatus.static.available ||
                     report.ffmpegStatus.wasm.available;

    if (hasFFmpeg) {
      TerminalUI.showSuccess('Your system is ready for video magic! 🎉');
    } else {
      console.log(`\n⚠️ Setup required before you can compile videos\n`);
    }
  } catch (error) {
    console.error('Diagnostics failed:', error.message);
    process.exit(1);
  }
}

runDiagnostics();