import { ChildProcess } from 'node:child_process';
import type * as ChildProcessModule from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
let child: ChildProcess;
let sent: any;
let root: string;
vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof ChildProcessModule>()),
  fork: () => child,
}));
import { runTitleEffect } from '../src/effects/effect-runner.js';
beforeEach(async () => {
  sent = undefined;
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'leclap-effect-runner-test-')));
  child = new ChildProcess();
  Object.assign(child, {
    pid: 424242,
    send: (job: any, cb: any) => {
      sent = job;
      cb?.(null);
      return true;
    },
    kill: (signal: any) => {
      queueMicrotask(() => {
        Object.assign(child, { exitCode: null, signalCode: signal });
        child.emit('exit', null, signal);
      });
      return true;
    },
  });
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});
it('waits for worker exit before cleaning a canceled bundle job', async () => {
  const pending = runTitleEffect({} as never, { mediaDir: root, renderTimeoutMs: 15 } as never, [{ kind: 'video' }]);
  await expect(pending).rejects.toThrow(/timed out/);
  expect(await fs.readdir(path.join(root, '.leclap-effects'))).toEqual([]);
});
it('keeps provenance/output directory after acknowledged successful rendering', async () => {
  const pending = runTitleEffect({} as never, { mediaDir: root, renderTimeoutMs: 1000 } as never, [{ kind: 'video' }]);
  await vi.waitFor(() => expect(sent?.directory).toBeTypeOf('string'));
  child.emit('message', {
    ok: true,
    results: [{ path: path.join(sent.directory, 'clip.mp4'), metadata: { duration: 10 } }],
    provenance: { hash: 'trusted' },
  });
  Object.assign(child, { exitCode: 0 });
  child.emit('exit', 0, null);
  const result = await pending;
  expect(result.provenance.hash).toBe('trusted');
  expect((await fs.stat(result.directory)).isDirectory()).toBe(true);
});
it('hard kills a worker that ignores termination and then cleans its directory', async () => {
  const signals: string[] = [];
  Object.assign(child, {
    kill: (signal: string) => {
      signals.push(signal);
      if (signal === 'SIGKILL') queueMicrotask(() => child.emit('exit', null, signal));
      return true;
    },
  });
  await expect(
    runTitleEffect({} as never, { mediaDir: root, renderTimeoutMs: 10 } as never, [{ kind: 'video' }])
  ).rejects.toThrow(/timed out/);
  expect(signals).toEqual(['SIGTERM', 'SIGKILL']);
  expect(await fs.readdir(path.join(root, '.leclap-effects'))).toEqual([]);
});
it('abort terminates a running worker before cleanup', async () => {
  const controller = new AbortController();
  const pending = runTitleEffect(
    {} as never,
    { mediaDir: root, renderTimeoutMs: 1000 } as never,
    [{ kind: 'video' }],
    controller.signal
  );
  await vi.waitFor(() => expect(sent?.directory).toBeTypeOf('string'));
  controller.abort();
  await expect(pending).rejects.toThrow(/aborted/);
  expect(await fs.readdir(path.join(root, '.leclap-effects'))).toEqual([]);
});
