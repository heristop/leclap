import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Readable } from 'node:stream';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Mock axios so fetch() can be driven through its success and stream-error paths
// without touching the network.
vi.mock('axios', () => ({ default: vi.fn() }));
import axios from 'axios';
import FilesystemNodeAdapter from '@/platform/filesystem/FilesystemNodeAdapter';

const mockedAxios = axios as unknown as ReturnType<typeof vi.fn>;
const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function makeAdapter(): FilesystemNodeAdapter {
  return new FilesystemNodeAdapter(logger as never);
}

describe('FilesystemNodeAdapter.fetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('streams the response body to a temp file and returns its path', async () => {
    mockedAxios.mockResolvedValue({ data: Readable.from(['hello world']) });

    const dest = await makeAdapter().fetch('https://example.com/file.bin');

    expect(dest).toBe(path.join(os.tmpdir(), 'file.bin'));
    expect(await fs.readFile(dest, 'utf-8')).toBe('hello world');

    await fs.unlink(dest).catch(() => undefined);
  });

  it('rejects and removes the partial file when the source stream errors', async () => {
    const errStream = new Readable({
      read() {
        this.destroy(new Error('stream boom'));
      },
    });
    mockedAxios.mockResolvedValue({ data: errStream });

    const dest = path.join(os.tmpdir(), 'err.bin');

    await expect(makeAdapter().fetch('https://example.com/err.bin')).rejects.toThrow('stream boom');
    // The partial download must not be left behind.
    await expect(fs.access(dest)).rejects.toBeInstanceOf(Error);
  });
});

describe('FilesystemNodeAdapter.append', () => {
  it("throws when the target file doesn't exist", async () => {
    const missing = path.join(os.tmpdir(), `vp-missing-${process.pid}.txt`);

    await expect(makeAdapter().append(missing, 'x')).rejects.toThrow(/doesn't exist/);
  });

  it('appends content to an existing file', async () => {
    const target = path.join(os.tmpdir(), `vp-append-${process.pid}.txt`);
    await fs.writeFile(target, 'a');

    await makeAdapter().append(target, 'b');

    expect(await fs.readFile(target, 'utf-8')).toBe('ab');

    await fs.unlink(target).catch(() => undefined);
  });
});

describe('FilesystemNodeAdapter.move', () => {
  it('throws when the source path does not exist', async () => {
    const missing = path.join(os.tmpdir(), `vp-nosrc-${process.pid}.bin`);

    await expect(makeAdapter().move(missing, path.join(os.tmpdir(), 'dst.bin'))).rejects.toThrow(/not found/);
  });
});
