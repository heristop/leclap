#!/usr/bin/env node

// Standalone diagnose script that uses the built version
// This avoids TypeScript path resolution issues

import 'reflect-metadata';
import { FFmpegDetector, Terminal } from './dist/index.js';
import pc from 'picocolors';

type DiagnosticsReport = Awaited<ReturnType<typeof FFmpegDetector.runFullDiagnostics>>;
type SystemInfo = DiagnosticsReport['systemInfo'];
type FFmpegStatus = DiagnosticsReport['ffmpegStatus'];

function printSystemRow({ os, arch, nodeVersion, packageManager, memoryGB }: SystemInfo) {
  const systemRow = `${pc.dim('OS')} ${os} ${arch}  ${pc.dim('Node')} ${nodeVersion}  ${pc.dim('PM')} ${packageManager}  ${pc.dim('RAM')} ${memoryGB}GB`;
  console.log(systemRow);
}

// Without system FFmpeg the render runs on ffmpeg-static, which can't probe media when it has no ffprobe.
function statusLine({ system, static: staticFFmpeg, wasm }: FFmpegStatus) {
  if (!system.available && staticFFmpeg.available && staticFFmpeg.ffprobe === false) {
    return pc.yellow('⚠ No ffprobe');
  }

  if (system.available || staticFFmpeg.available || wasm.available) {
    return pc.green('✓ Ready');
  }

  return pc.yellow('⚠ No FFmpeg');
}

function printRecommendations(recommendations: DiagnosticsReport['recommendations']) {
  if (recommendations.length > 0) {
    console.log(pc.dim('\nInfo:'));

    for (const rec of recommendations) {
      const clean = rec.replace(/🚀|⚠️|✨|Perfect!|/g, '').trim();
      console.log(`  ${clean}`);
    }
  }
}

async function runDiagnostics() {
  try {
    console.clear();

    const report = await FFmpegDetector.runFullDiagnostics(false);
    const { os, arch, nodeVersion, packageManager, memoryGB } = report.systemInfo;

    // Grid layout - ultra synthetic
    console.log(pc.bold(pc.cyan('\nFFmpeg Video Composer Diagnostics\n')));

    printSystemRow({ os, arch, nodeVersion, packageManager, memoryGB });
    Terminal.showFFmpegStatus(report.ffmpegStatus);

    console.log(`\n${statusLine(report.ffmpegStatus)}`);

    printRecommendations(report.recommendations);

    console.log();
  } catch (error) {
    console.error(pc.red('\n✗ Failed:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

runDiagnostics().catch((error: unknown) => {
  console.error(pc.red('\n✗ Unexpected:'), error instanceof Error ? error.message : String(error));
  process.exit(1);
});
