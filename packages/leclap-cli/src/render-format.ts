import { statSync } from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { success } from './ui.js';
import { dot } from './theme.js';

// Human-readable byte size, e.g. 1.4 MB. Best-effort; a stat failure yields an empty string so the
// summary still renders.
export function prettySize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }

  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

// File size in bytes, or 0 when it can't be measured (the size aside is decorative).
export function safeSize(file: string): number {
  try {
    return statSync(file).size;
  } catch {
    return 0;
  }
}

// The one-line render result: a cwd-relative output path (the absolute path is long and noisy) with the
// file size and elapsed time as a dim trailing aside.
export function summaryLine(outputPath: string, startedAt: number, cwd: string, now: number): string {
  const seconds = ((now - startedAt) / 1000).toFixed(1);
  const rel = path.relative(cwd, outputPath) || outputPath;
  const bytes = safeSize(outputPath);
  const size = bytes > 0 ? `${prettySize(bytes)}  ${dot}  ` : '';

  return success(`Rendered ${pc.dim('→')} ${pc.bold(rel)}  ${pc.dim(`${size}${seconds}s`)}`);
}
