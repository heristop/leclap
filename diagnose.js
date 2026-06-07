#!/usr/bin/env node

// Standalone diagnose script that uses the built version
// This avoids TypeScript path resolution issues

import 'reflect-metadata';
import { FFmpegDetector } from './dist/index.js';
import pc from 'picocolors';

function formatShort(info) {
  return info.available ? pc.green('✓') : pc.dim('✗');
}

function printSystemRow({ os, arch, nodeVersion, packageManager, memoryGB }) {
  const systemRow = `${pc.dim('OS')} ${os} ${arch}  ${pc.dim('Node')} ${nodeVersion}  ${pc.dim('PM')} ${packageManager}  ${pc.dim('RAM')} ${memoryGB}GB`;
  console.log(systemRow);
}

function printFFmpegRow({ system, staticFFmpeg, wasm }) {
  const ffmpegRow = `${pc.dim('FFmpeg')} ${formatShort(system)} sys ${system.available ? pc.green(system.version) : ''}  ${formatShort(staticFFmpeg)} static  ${formatShort(wasm)} wasm`;
  console.log(ffmpegRow);
}

function printRecommendations(recommendations) {
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
    const { system, static: staticFFmpeg, wasm } = report.ffmpegStatus;

    // Grid layout - ultra synthetic
    console.log(pc.bold(pc.cyan('\nFFmpeg Video Composer Diagnostics\n')));

    printSystemRow({ os, arch, nodeVersion, packageManager, memoryGB });
    printFFmpegRow({ system, staticFFmpeg, wasm });

    // Status
    const hasFFmpeg = system.available || staticFFmpeg.available || wasm.available;
    const status = hasFFmpeg ? pc.green('✓ Ready') : pc.yellow('⚠ No FFmpeg');
    console.log(`\n${status}`);

    printRecommendations(report.recommendations);

    console.log();
  } catch (error) {
    console.error(pc.red('\n✗ Failed:'), error.message);
    process.exit(1);
  }
}

runDiagnostics().catch((error) => {
  console.error(pc.red('\n✗ Unexpected:'), error.message);
  process.exit(1);
});
