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

// Mock DNS resolution so the SSRF guard can be exercised deterministically without
// touching a real resolver (and so we can simulate rebinding to a private IP).
const mockedLookup = vi.fn();
vi.mock('node:dns/promises', () => ({ lookup: (...args: unknown[]) => mockedLookup(...args) }));

import FilesystemNodeAdapter from '@/platform/filesystem/FilesystemNodeAdapter';

const mockedAxios = axios as unknown as ReturnType<typeof vi.fn>;
const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function makeAdapter(): FilesystemNodeAdapter {
  return new FilesystemNodeAdapter(logger as never);
}

describe('FilesystemNodeAdapter.fetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: hostnames resolve to a public address unless a test overrides it.
    mockedLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
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

describe('FilesystemNodeAdapter.fetch SSRF guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAxios.mockResolvedValue({ data: Readable.from(['public body']) });
    mockedLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  });

  it('rejects a non-http(s) scheme (file://) before fetching', async () => {
    await expect(makeAdapter().fetch('file:///etc/passwd')).rejects.toThrow();
    expect(mockedAxios).not.toHaveBeenCalled();
  });

  it('rejects the cloud-metadata link-local address', async () => {
    await expect(makeAdapter().fetch('http://169.254.169.254/latest/meta-data/')).rejects.toThrow();
    expect(mockedAxios).not.toHaveBeenCalled();
  });

  it('rejects localhost and loopback literals', async () => {
    await expect(makeAdapter().fetch('http://localhost:9200/')).rejects.toThrow();
    await expect(makeAdapter().fetch('http://127.0.0.1/')).rejects.toThrow();
    expect(mockedAxios).not.toHaveBeenCalled();
  });

  it('rejects private RFC1918 ranges', async () => {
    await expect(makeAdapter().fetch('http://10.0.0.5/x')).rejects.toThrow();
    await expect(makeAdapter().fetch('http://192.168.1.1/')).rejects.toThrow();
    expect(mockedAxios).not.toHaveBeenCalled();
  });

  it('rejects a public hostname that resolves (rebinds) to a private IP', async () => {
    mockedLookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);

    await expect(makeAdapter().fetch('https://evil.example.com/clip.mp4')).rejects.toThrow();
    expect(mockedAxios).not.toHaveBeenCalled();
  });

  it('allows a normal public host and proceeds with the download', async () => {
    const dest = await makeAdapter().fetch('https://cdn.example.com/clip.mp4');

    expect(mockedLookup).toHaveBeenCalledWith('cdn.example.com', { all: true });
    expect(mockedAxios).toHaveBeenCalledTimes(1);
    expect(dest).toBe(path.join(os.tmpdir(), 'clip.mp4'));
    expect(await fs.readFile(dest, 'utf-8')).toBe('public body');

    await fs.unlink(dest).catch(() => undefined);
  });
});

describe('FilesystemNodeAdapter.fetch local staged path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('copies a local file under the staged assets dir without hitting the network', async () => {
    const stageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vp-stage-'));
    const source = path.join(stageDir, 'staged.bin');
    await fs.writeFile(source, 'staged content');

    const adapter = makeAdapter();
    adapter.setAssetsDir(stageDir);

    const dest = await adapter.fetch(source);

    expect(mockedAxios).not.toHaveBeenCalled();
    expect(mockedLookup).not.toHaveBeenCalled();
    expect(await fs.readFile(dest, 'utf-8')).toBe('staged content');

    await fs.rm(stageDir, { recursive: true, force: true });
    await fs.unlink(dest).catch(() => undefined);
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
