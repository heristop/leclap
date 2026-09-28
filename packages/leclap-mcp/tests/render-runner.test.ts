import { ChildProcess } from 'node:child_process';
import type * as ChildProcessModule from 'node:child_process';
import { existsSync, mkdtempSync, promises as fs, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GeometryJob } from '../src/worker/geometry-job.js';

// A stand-in for the forked render worker: a ChildProcess that never spawned, driven by the test. Like
// the real check, it renders into a `leclap-render-check-*` folder under the workDir it is given and
// removes that folder only when it gets to finish; killing it exits it, as SIGTERM does a real worker,
// leaving the folder behind.
interface FakeWorker {
  process: ChildProcess;
  job?: GeometryJob;
  scratchExistedAtSend: boolean;
  finish: () => void;
  exit: (code: number | null, signal?: NodeJS.Signals | null) => void;
}

function fakeWorker(): FakeWorker {
  const child = new ChildProcess();
  let renderDir = '';
  const fake: FakeWorker = {
    process: child,
    scratchExistedAtSend: false,
    finish: () => {
      rmSync(renderDir, { recursive: true, force: true });
      child.emit('message', { ok: true, geometry: { warnings: [], measured: 0 } });
      fake.exit(0);
    },
    exit: (code, signal = null) => {
      Object.assign(child, { exitCode: code, signalCode: signal });
      child.emit('exit', code, signal);
    },
  };

  Object.assign(child, {
    pid: 4242,
    send: (job: GeometryJob, callback: (error: Error | null) => void) => {
      fake.job = job;
      fake.scratchExistedAtSend = existsSync(job.options.workDir ?? '');
      renderDir = mkdtempSync(path.join(job.options.workDir ?? '', 'leclap-render-check-'));
      writeFileSync(path.join(renderDir, 'frame-0.rgb'), 'pixels');
      callback(null);

      return true;
    },
    kill: (signal: NodeJS.Signals) => {
      setImmediate(() => {
        fake.exit(null, signal);
      });

      return true;
    },
  });

  return fake;
}

let worker: FakeWorker;

vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof ChildProcessModule>()),
  fork: () => worker.process,
}));

const { runGeometryCheck } = await import('../src/compose/renderRunner.js');

let outputDir: string;

function job(): GeometryJob {
  return {
    kind: 'geometry',
    descriptor: { sections: [] } as unknown as GeometryJob['descriptor'],
    options: { assetsDir: '/media', workDir: outputDir },
  };
}

async function leftovers(): Promise<string[]> {
  return (await fs.readdir(outputDir)).filter((name) => name.startsWith('leclap-render-check-'));
}

// The worker's own cleanup never runs when it is killed, so the parent owns the scratch dir: it hands
// the worker a folder of its own inside the output dir, and removes it once the worker is gone.
describe('runGeometryCheck scratch dir', () => {
  beforeEach(async () => {
    worker = fakeWorker();
    outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'leclap-runner-'));
  });

  afterEach(async () => {
    await fs.rm(outputDir, { recursive: true, force: true });
  });

  it('hands the worker a scratch dir of its own inside the output dir', async () => {
    const pending = runGeometryCheck(job(), { timeoutMs: 60_000 });

    await vi.waitFor(() => {
      expect(worker.job).toBeDefined();
    });
    worker.finish();
    await pending;

    expect(worker.scratchExistedAtSend).toBe(true);
    expect(path.dirname(worker.job?.options.workDir ?? '')).toBe(outputDir);
    expect(await leftovers()).toEqual([]);
  });

  it('removes it when the worker is killed on timeout', async () => {
    const result = await runGeometryCheck(job(), { timeoutMs: 5 });

    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/timed out/) });
    expect(await leftovers()).toEqual([]);
  });

  it('removes it when the call is cancelled', async () => {
    const controller = new AbortController();
    const pending = runGeometryCheck(job(), { timeoutMs: 60_000, signal: controller.signal });

    await vi.waitFor(() => {
      expect(worker.job).toBeDefined();
    });
    controller.abort();

    expect(await pending).toMatchObject({ ok: false, error: 'render cancelled' });
    expect(await leftovers()).toEqual([]);
  });

  it('removes it when the worker crashes', async () => {
    const pending = runGeometryCheck(job(), { timeoutMs: 60_000 });

    await vi.waitFor(() => {
      expect(worker.job).toBeDefined();
    });
    worker.exit(1);

    expect(await pending).toMatchObject({ ok: false, error: expect.stringMatching(/exited/) });
    expect(await leftovers()).toEqual([]);
  });
});
