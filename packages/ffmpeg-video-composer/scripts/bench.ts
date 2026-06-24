import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ffmpegSharePct, formatPerfReport } from '../src/utils/perf-report';
import type { PerfReport } from '../src/utils/perf-timer';

// Benchmark harness: runs the built CLI (compile.ts → dist/) over a curated set of fixtures with
// FVC_PERF on, takes the median per-phase wall time across N runs (a warmup run is discarded), and
// reports the FFmpeg share of each compile. Results are written to build/bench-<gitsha>.json and
// diffed against the most recent previous bench file.
//
// Why shell out to the built CLI instead of importing src directly: the pipeline uses tsyringe
// constructor injection, which needs emitDecoratorMetadata. tsx/esbuild does not emit it, so
// importing src here would break DI. tsdown's build does emit it, so we run dist/. Run via
// `pnpm bench` (pass fixture base names as args to override the default set).
//
// Numbers are I/O/CPU-noisy (real ffmpeg processes) — read the median, not a single run, and treat
// per-phase deltas under the noise floor as non-actionable.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(pkgRoot, '../..');
const fixturesDir = path.resolve(pkgRoot, 'tests/fixtures');
const compileScript = path.resolve(pkgRoot, 'compile.ts');
const distEntry = path.resolve(pkgRoot, 'dist/index.js');
const buildDir = path.resolve(repoRoot, 'build');

const RUNS = Number(process.env.BENCH_RUNS ?? '3');

// Curated set: small / image / medium / transitions-heavy. Override via CLI args
// (e.g. `pnpm bench gradient transitions`).
const DEFAULT_FIXTURES = ['gradient', 'picture', 'fast-and-curious', 'transitions'];

interface FixtureResult {
  fixture: string;
  runs: number;
  report: PerfReport | null;
  skippedReason?: string;
}

interface BenchFile {
  sha: string;
  host: string;
  runs: number;
  fixtures: Array<{ fixture: string; totalMs: number; ffmpegSharePct: number; skippedReason?: string }>;
}

function gitSha(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'nogit';
  }
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }

  return (sorted[mid - 1] + sorted[mid]) / 2;
}

// Collapse N per-run reports into one median report (median ms per label, median total).
function medianReport(reports: PerfReport[]): PerfReport {
  const byLabel = new Map<string, { ms: number[]; count: number }>();

  for (const report of reports) {
    for (const span of report.spans) {
      const entry = byLabel.get(span.label) ?? { ms: [], count: span.count };
      entry.ms.push(span.ms);
      entry.count = span.count;
      byLabel.set(span.label, entry);
    }
  }

  const spans = [...byLabel.entries()]
    .map(([label, entry]) => ({ label, ms: median(entry.ms), count: entry.count }))
    .sort((a, b) => b.ms - a.ms);

  return { totalMs: median(reports.map((r) => r.totalMs)), spans };
}

// Run one compile of a fixture through the built CLI and return the perf report it writes.
function runOnce(fixturePath: string, outPath: string): PerfReport | null {
  rmSync(outPath, { force: true });

  try {
    execFileSync('node', [compileScript, fixturePath], {
      cwd: repoRoot,
      stdio: ['ignore', 'ignore', 'pipe'],
      env: { ...process.env, FVC_PERF: '1', FVC_PERF_OUT: outPath, FFMPEG_COMPOSER_SKIP_WELCOME: '1' },
    });
  } catch {
    return null;
  }

  if (!existsSync(outPath)) {
    return null;
  }

  return JSON.parse(readFileSync(outPath, 'utf8'));
}

function benchFixture(name: string): FixtureResult {
  const fixturePath = path.resolve(fixturesDir, `${name}.json`);

  if (!existsSync(fixturePath)) {
    return { fixture: name, runs: 0, report: null, skippedReason: 'fixture not found' };
  }

  const outPath = path.resolve(buildDir, `perf-bench-${name}.json`);
  const reports: PerfReport[] = [];

  for (let i = 0; i < RUNS; i++) {
    const report = runOnce(fixturePath, outPath);

    if (report === null) {
      return { fixture: name, runs: i, report: null, skippedReason: 'compile failed (render error)' };
    }

    if (i === 0 && RUNS > 1) {
      continue; // discard warmup
    }

    reports.push(report);
  }

  if (reports.length === 0) {
    return { fixture: name, runs: 0, report: null, skippedReason: 'no successful timed runs' };
  }

  return { fixture: name, runs: reports.length, report: medianReport(reports) };
}

function loadPreviousBench(currentFile: string): { file: string; data: BenchFile } | null {
  let entries: string[];

  try {
    entries = readdirSync(buildDir).filter((f) => f.startsWith('bench-') && f.endsWith('.json'));
  } catch {
    return null;
  }

  const candidates = entries
    .map((f) => path.resolve(buildDir, f))
    .filter((f) => f !== currentFile)
    .map((f) => ({ file: f, mtime: statSync(f).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  if (candidates.length === 0) {
    return null;
  }

  try {
    return { file: candidates[0].file, data: JSON.parse(readFileSync(candidates[0].file, 'utf8')) };
  } catch {
    return null;
  }
}

function printDelta(current: BenchFile, previous: { file: string; data: BenchFile } | null): void {
  if (previous === null) {
    console.log('\nNo previous bench file to diff against.');

    return;
  }

  console.log(`\nDelta vs ${path.basename(previous.file)} (sha ${previous.data.sha}):`);

  const prevByName = new Map(previous.data.fixtures.map((f) => [f.fixture, f]));

  for (const f of current.fixtures) {
    const prev = prevByName.get(f.fixture);

    if (!prev || prev.skippedReason || f.skippedReason) {
      console.log(`  ${f.fixture.padEnd(20)} (no comparable baseline)`);

      continue;
    }

    const diff = f.totalMs - prev.totalMs;
    const sign = diff >= 0 ? '+' : '';
    const pct = prev.totalMs > 0 ? ((diff / prev.totalMs) * 100).toFixed(1) : '0.0';
    console.log(`  ${f.fixture.padEnd(20)} ${sign}${diff.toFixed(1)}ms (${sign}${pct}%)`);
  }
}

function ensureDistBuilt(): void {
  if (existsSync(distEntry)) {
    return;
  }

  console.log('dist/ not found — building the package first (tsdown)…');
  execFileSync('pnpm', ['--filter', 'ffmpeg-video-composer', 'build'], { cwd: repoRoot, stdio: 'inherit' });
}

function toBenchFile(sha: string, results: FixtureResult[]): BenchFile {
  return {
    sha,
    host: os.hostname(),
    runs: RUNS,
    fixtures: results.map((r) => ({
      fixture: r.fixture,
      totalMs: r.report?.totalMs ?? 0,
      ffmpegSharePct: r.report ? ffmpegSharePct(r.report) : 0,
      skippedReason: r.skippedReason,
    })),
  };
}

function runFixtures(fixtures: string[]): FixtureResult[] {
  const results: FixtureResult[] = [];

  for (const name of fixtures) {
    process.stdout.write(`\n▶ ${name} `);

    const result = benchFixture(name);
    results.push(result);

    if (result.report === null) {
      console.log(`SKIPPED — ${result.skippedReason}`);

      continue;
    }

    console.log(`(median of ${result.runs})`);
    console.log(formatPerfReport(result.report));
  }

  return results;
}

function writeAndReport(results: FixtureResult[]): void {
  const sha = gitSha();
  const outFile = path.resolve(buildDir, `bench-${sha}.json`);
  const benchFile = toBenchFile(sha, results);
  const previous = loadPreviousBench(outFile);

  writeFileSync(outFile, `${JSON.stringify(benchFile, null, 2)}\n`, 'utf8');
  console.log(`\nWrote ${outFile}`);

  printDelta(benchFile, previous);

  const skipped = results.filter((r) => r.report === null);

  if (skipped.length > 0) {
    console.log(`\n${skipped.length}/${results.length} fixtures skipped: ${skipped.map((r) => r.fixture).join(', ')}`);
  }
}

function main(): void {
  ensureDistBuilt();
  mkdirSync(buildDir, { recursive: true });

  const fixtures = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_FIXTURES;
  console.log(`Bench: ${fixtures.length} fixtures × ${RUNS} runs (1 warmup discarded when RUNS>1) on ${os.hostname()}`);

  const results = runFixtures(fixtures);
  writeAndReport(results);
}

main();
