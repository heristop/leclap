import { fork, type ChildProcess } from 'node:child_process';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import type { ProjectConfig, TemplateDescriptor } from 'ffmpeg-video-composer';

// One render job, shipped to the forked worker over IPC.
export interface RenderJob {
  projectConfig: ProjectConfig;
  template: TemplateDescriptor;
}

// The worker's success payload includes ffmpeg metadata under `infos`; the runner flattens the
// fields it surfaces so callers don't depend on the core's FFMpegInfos shape.
interface WorkerInfos {
  duration: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
}

interface WorkerMessage {
  ok: boolean;
  outputPath?: string;
  infos?: WorkerInfos;
  sizeBytes?: number;
  error?: string;
}

export type RenderResult =
  | {
      ok: true;
      outputPath: string;
      durationSeconds: number | null;
      sizeBytes: number;
      videoCodec: string | null;
      audioCodec: string | null;
    }
  | { ok: false; error: string; logTail?: string };

export interface RenderOptions {
  timeoutMs: number;
}

const GRACE_MS = 5_000;
const RING_LIMIT = 16 * 1024;

// Each render forks a worker that runs a fully-threaded ffmpeg, so a handful of parallel renders
// already saturates the host. Cap concurrent workers (leaving headroom) and queue the rest, so a
// burst of compose_video calls can't exhaust CPU/memory/file descriptors.
const MAX_CONCURRENT_RENDERS = Math.max(1, Math.min(4, Math.floor(os.cpus().length / 2)));

// Minimal FIFO async semaphore: acquire() resolves when a slot is free, release() hands the slot to
// the next waiter (or frees it). `active` counts occupied slots; a queued waiter inherits a slot on
// release without a decrement, so the count never drifts.
class Semaphore {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly max: number) {}

  acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active += 1;

      return Promise.resolve();
    }

    return new Promise<void>((resolve) => this.queue.push(resolve));
  }

  release(): void {
    const next = this.queue.shift();

    if (next) {
      next();

      return;
    }

    this.active -= 1;
  }
}

const renderSemaphore = new Semaphore(MAX_CONCURRENT_RENDERS);

// dist/render-worker.js sits beside the bundled dist/index.js this runner is compiled into, so
// resolve it relative to the runner's own module URL at runtime (works regardless of cwd).
function workerPath(): string {
  return fileURLToPath(new URL('./render-worker.js', import.meta.url));
}

// Capped tail buffer: keeps the last ~16 KB of the child's stdout+stderr for error reporting,
// so a chatty render can't grow memory without bound.
class RingBuffer {
  private readonly chunks: string[] = [];
  private size = 0;

  append(text: string): void {
    this.chunks.push(text);
    this.size += text.length;

    while (this.size > RING_LIMIT && this.chunks.length > 1) {
      const dropped = this.chunks.shift() ?? '';
      this.size -= dropped.length;
    }
  }

  toString(): string {
    return this.chunks.join('').slice(-RING_LIMIT);
  }
}

function captureStreams(child: ChildProcess, ring: RingBuffer): void {
  child.stdout?.on('data', (data: Buffer) => {
    ring.append(data.toString('utf8'));
  });
  child.stderr?.on('data', (data: Buffer) => {
    ring.append(data.toString('utf8'));
  });
}

// Lead the failure message with the most relevant line the core logged, when present.
function leadLine(logTail: string): string | undefined {
  const lines = logTail.split('\n');
  const hit = lines.find((line) => line.includes('Compilation error:') || line.includes('FFmpeg command failed'));

  return hit?.trim();
}

function successResult(msg: WorkerMessage): RenderResult {
  return {
    ok: true,
    outputPath: msg.outputPath ?? '',
    durationSeconds: msg.infos?.duration ?? null,
    sizeBytes: msg.sizeBytes ?? 0,
    videoCodec: msg.infos?.videoCodec ?? null,
    audioCodec: msg.infos?.audioCodec ?? null,
  };
}

function failureResult(msg: WorkerMessage, logTail: string): RenderResult {
  const lead = leadLine(logTail);
  const base = msg.error ?? lead ?? 'compilation failed';

  return { ok: false, error: base, logTail };
}

// Force the child down: SIGTERM first, then SIGKILL after a short grace if it is still alive.
function killChild(child: ChildProcess): void {
  child.kill('SIGTERM');
  const grace = setTimeout(() => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
    }
  }, GRACE_MS);
  grace.unref();
}

// Per-render state shared between the event handlers, so each handler stays tiny and the
// resolve-once guard lives in one place.
interface RunState {
  child: ChildProcess;
  ring: RingBuffer;
  settled: boolean;
  resolve: (result: RenderResult) => void;
}

function settle(state: RunState, result: RenderResult): void {
  if (state.settled) {
    return;
  }

  state.settled = true;
  state.resolve(result);
}

function onMessage(state: RunState, msg: WorkerMessage): void {
  const logTail = state.ring.toString();
  const result = msg.ok ? successResult(msg) : failureResult(msg, logTail);

  settle(state, result);
}

function onExit(state: RunState, code: number | null): void {
  settle(state, {
    ok: false,
    error: `render worker exited (code ${code ?? 'unknown'})`,
    logTail: state.ring.toString(),
  });
}

// A fork() that never spawns (missing worker bundle, EMFILE, ENOMEM) or a send() over a closed
// channel emits 'error'. Without a listener Node throws it as an uncaught exception, which would
// crash the whole stdio server instead of failing just this render.
function onError(state: RunState, error: Error): void {
  settle(state, {
    ok: false,
    error: `render worker failed: ${error.message}`,
    logTail: state.ring.toString(),
  });
}

function onTimeout(state: RunState, timeoutMs: number): void {
  killChild(state.child);
  settle(state, {
    ok: false,
    error: `render timed out after ${timeoutMs}ms`,
    logTail: state.ring.toString(),
  });
}

function executeRender(job: RenderJob, opts: RenderOptions): Promise<RenderResult> {
  return new Promise<RenderResult>((resolve) => {
    const ring = new RingBuffer();
    const child = fork(workerPath(), [], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    const state: RunState = { child, ring, settled: false, resolve };

    captureStreams(child, ring);

    const timer = setTimeout(() => {
      onTimeout(state, opts.timeoutMs);
    }, opts.timeoutMs);
    timer.unref();

    child.on('message', (msg: WorkerMessage) => {
      clearTimeout(timer);
      onMessage(state, msg);
    });

    child.on('exit', (code) => {
      clearTimeout(timer);
      onExit(state, code);
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      onError(state, error);
    });

    child.send(job, (error) => {
      if (!error) {
        return;
      }

      clearTimeout(timer);
      onError(state, error);
    });
  });
}

// Bound how many worker forks run at once; queued calls wait for a free slot before forking.
export async function runRender(job: RenderJob, opts: RenderOptions): Promise<RenderResult> {
  await renderSemaphore.acquire();

  try {
    return await executeRender(job, opts);
  } finally {
    renderSemaphore.release();
  }
}
