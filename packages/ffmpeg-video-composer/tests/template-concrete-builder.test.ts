import 'reflect-metadata';
import { vi, beforeEach, describe, it, expect, type Mock } from 'vitest';

// Mock FFmpegWasmAdapter so we can construct a fake WASM adapter without
// triggering the real WebAssembly dynamic import / initialization.
vi.mock('@/platform/ffmpeg/FFmpegWasmAdapter', () => {
  class MockFFmpegWasmAdapter {
    execute = vi.fn();
    getInfos = vi.fn();
    waitForReady = vi.fn();
    writeFile = vi.fn();
    readFile = vi.fn();
    deleteFile = vi.fn();
    listDir = vi.fn();
  }

  return { default: MockFFmpegWasmAdapter };
});

// Mock SegmentFactory so buildPart() returns a controllable stub segment
// (avoids needing the full tsyringe container of managers/segment classes).
const segmentStub = {
  destination: '/build/seg_output.mp4',
  inputsAsset: {} as Record<string, string>,
  command: '-y -i input.mp4 out.mp4',
  initResult: true,
  getCommand: vi.fn(() => segmentStub.command),
  getProject: vi.fn(() => ({ config: {} as Record<string, unknown> })),
  init: vi.fn(async () => segmentStub.initResult),
};

const createMock = vi.fn(() => segmentStub);

vi.mock('@/editor/factories/SegmentFactory', () => {
  class MockSegmentFactory {
    create = createMock;
  }

  return { default: MockSegmentFactory };
});

import TemplateConcreteBuilder from '@/director/TemplateConcreteBuilder';
import FFmpegWasmAdapter from '@/platform/ffmpeg/FFmpegWasmAdapter';
import type { ProjectConfig, Section } from '@/core/types';

type ProjectStub = { errors: string[]; config: ProjectConfig };

function makeLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function makeFilesystem() {
  return {
    stat: vi.fn(async () => true),
    writeFile: vi.fn(async () => undefined),
    readFile: vi.fn(async () => new Uint8Array([1, 2, 3])),
  };
}

function makeBuilder(opts: {
  project?: ProjectStub;
  logger?: ReturnType<typeof makeLogger>;
  ffmpeg?: { execute: ReturnType<typeof vi.fn> };
  filesystem?: ReturnType<typeof makeFilesystem>;
}) {
  const project = opts.project ?? { errors: [], config: {} };
  const logger = opts.logger ?? makeLogger();
  const ffmpeg = opts.ffmpeg ?? { execute: vi.fn(async () => ({ rc: 0 })) };
  const filesystem = opts.filesystem ?? makeFilesystem();

  const builder = new TemplateConcreteBuilder(project as never, logger as never, ffmpeg as never, filesystem as never);

  return { builder, project, logger, ffmpeg, filesystem };
}

const baseSection: Section = {
  name: 'intro',
  type: 'video',
  options: { duration: 5 },
};

beforeEach(() => {
  vi.clearAllMocks();
  segmentStub.destination = '/build/seg_output.mp4';
  segmentStub.inputsAsset = {};
  segmentStub.command = '-y -i input.mp4 out.mp4';
  segmentStub.initResult = true;
});

describe('TemplateConcreteBuilder.buildPart', () => {
  it('creates a segment via the factory and returns the init result', async () => {
    const { builder } = makeBuilder({});
    const config: ProjectConfig = { buildDir: '/build' };

    const result = await builder.buildPart(baseSection, config);

    expect(result).toBe(true);
    expect(createMock).toHaveBeenCalledWith(baseSection);
    expect(segmentStub.init).toHaveBeenCalled();
  });

  it('returns false when the segment fails to init', async () => {
    segmentStub.initResult = false;
    const { builder } = makeBuilder({});

    const result = await builder.buildPart(baseSection, { buildDir: '/build' });

    expect(result).toBe(false);
  });

  it('assigns the projectConfig to the project when the section is project_video', async () => {
    const { builder } = makeBuilder({});
    const projectVideoSection: Section = { name: 'clip', type: 'project_video', options: {} };
    const config: ProjectConfig = { buildDir: '/build', currentLocale: 'fr' };

    const projectFromSegment = { config: {} as ProjectConfig };
    segmentStub.getProject.mockReturnValueOnce(projectFromSegment);

    await builder.buildPart(projectVideoSection, config);

    expect(projectFromSegment.config).toBe(config);
  });
});

describe('TemplateConcreteBuilder.renderPart (native adapter)', () => {
  it('does nothing harmful when no command is present but still executes', async () => {
    segmentStub.command = '';
    const { builder, logger, ffmpeg } = makeBuilder({});

    await builder.buildPart(baseSection, { buildDir: '/build' });
    await builder.renderPart();

    expect(logger.info).toHaveBeenCalledWith('[intro][RenderPart] No command available');
    expect(ffmpeg.execute).toHaveBeenCalledWith('');
  });

  it('checks the output file exists on rc 0 (success path)', async () => {
    const filesystem = makeFilesystem();
    filesystem.stat.mockResolvedValue(true);
    const { builder, project } = makeBuilder({
      ffmpeg: { execute: vi.fn(async () => ({ rc: 0 })) },
      filesystem,
    });

    await builder.buildPart(baseSection, { buildDir: '/build' });
    await builder.renderPart();

    expect(filesystem.stat).toHaveBeenCalledWith('/build/seg_output.mp4');
    expect(project.errors).toHaveLength(0);
  });

  it('records an error when the output file is missing on rc 0', async () => {
    const filesystem = makeFilesystem();
    // stat resolves false for a missing file (the adapter contract returns a boolean, never throws).
    filesystem.stat.mockResolvedValue(false);
    const { builder, project, logger } = makeBuilder({
      ffmpeg: { execute: vi.fn(async () => ({ rc: 0 })) },
      filesystem,
    });

    await builder.buildPart(baseSection, { buildDir: '/build' });
    await builder.renderPart();

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[intro][RenderPart] output file not found'));
    expect(project.errors).toContain('intro');
  });

  it('pushes the section name to project errors when ffmpeg returns rc 1', async () => {
    const { builder, project } = makeBuilder({
      ffmpeg: { execute: vi.fn(async () => ({ rc: 1 })) },
    });

    await builder.buildPart(baseSection, { buildDir: '/build' });
    await builder.renderPart();

    expect(project.errors).toContain('intro');
  });
});

describe('TemplateConcreteBuilder.renderPart (WASM adapter)', () => {
  function makeWasmAdapter() {
    const wasm = new FFmpegWasmAdapter({} as never) as unknown as {
      execute: ReturnType<typeof vi.fn>;
      readFile: ReturnType<typeof vi.fn>;
      writeFile: ReturnType<typeof vi.fn>;
      deleteFile: ReturnType<typeof vi.fn>;
      listDir: Mock<(path: string) => Promise<{ name: string; isDir: boolean }[]>>;
    };

    return wasm;
  }

  it('writes input files to WASM, finds the output directly and transfers to filesystem', async () => {
    const wasm = makeWasmAdapter();
    wasm.execute.mockResolvedValue({ rc: 0 });
    wasm.readFile.mockResolvedValue(new Uint8Array([9, 9])); // found directly at root
    wasm.writeFile.mockResolvedValue(undefined);
    wasm.deleteFile.mockResolvedValue(undefined);

    segmentStub.inputsAsset = { asset_a: '/assets/a.png', asset_b: '/assets/b.png' };

    const filesystem = makeFilesystem();
    const { builder, project } = makeBuilder({ ffmpeg: wasm as never, filesystem });

    await builder.buildPart(baseSection, { buildDir: '/build' });
    await builder.renderPart();

    // input files were written to WASM memory
    expect(wasm.writeFile).toHaveBeenCalledWith('a.png', expect.any(Uint8Array));
    expect(wasm.writeFile).toHaveBeenCalledWith('b.png', expect.any(Uint8Array));
    // output read from WASM and transferred to filesystem (IndexedDB)
    expect(wasm.readFile).toHaveBeenCalledWith('/build/seg_output.mp4');
    expect(filesystem.writeFile).toHaveBeenCalledWith('/build/seg_output.mp4', expect.any(Uint8Array));
    expect(wasm.deleteFile).toHaveBeenCalledWith('/build/seg_output.mp4');
    expect(project.errors).toHaveLength(0);
  });

  it('skips writing input files when there are no input assets', async () => {
    const wasm = makeWasmAdapter();
    wasm.execute.mockResolvedValue({ rc: 0 });
    wasm.readFile.mockResolvedValue(new Uint8Array([1]));
    wasm.writeFile.mockResolvedValue(undefined);
    wasm.deleteFile.mockResolvedValue(undefined);

    segmentStub.inputsAsset = {};

    const { builder, logger } = makeBuilder({ ffmpeg: wasm as never });

    await builder.buildPart(baseSection, { buildDir: '/build' });
    await builder.renderPart();

    expect(logger.info).toHaveBeenCalledWith('[intro][WASM] No input assets to load');
    expect(wasm.writeFile).not.toHaveBeenCalled();
  });

  it('warns for large input files (>50MB) when writing to WASM', async () => {
    const wasm = makeWasmAdapter();
    wasm.execute.mockResolvedValue({ rc: 0 });
    wasm.readFile.mockResolvedValue(new Uint8Array([1]));
    wasm.writeFile.mockResolvedValue(undefined);
    wasm.deleteFile.mockResolvedValue(undefined);

    segmentStub.inputsAsset = { asset_big: '/assets/big.mp4' };

    const filesystem = makeFilesystem();
    // 60MB asset read from filesystem
    filesystem.readFile.mockResolvedValue(new Uint8Array(60 * 1024 * 1024));

    const { builder, logger } = makeBuilder({ ffmpeg: wasm as never, filesystem });

    await builder.buildPart(baseSection, { buildDir: '/build' });
    await builder.renderPart();

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('[intro][WASM] Warning: Large file'));
  });

  it('throws and records an error when a WASM input file fails to write', async () => {
    const wasm = makeWasmAdapter();
    wasm.execute.mockResolvedValue({ rc: 0 });
    wasm.writeFile.mockRejectedValue(new Error('quota exceeded'));

    segmentStub.inputsAsset = { asset_a: '/assets/a.png' };

    const { builder, logger } = makeBuilder({ ffmpeg: wasm as never });

    await builder.buildPart(baseSection, { buildDir: '/build' });

    await expect(builder.renderPart()).rejects.toThrow('Failed to write input file asset_a');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('[intro][WASM] Failed to write input file asset_a')
    );
  });

  it('searches /tmp when the output is not at root and transfers from there', async () => {
    const wasm = makeWasmAdapter();
    wasm.execute.mockResolvedValue({ rc: 0 });
    // In WASM, the destination is a bare filename living in MEMFS.
    segmentStub.destination = 'seg_output.mp4';
    // direct readFile at root rejects -> triggers directory search
    wasm.readFile.mockRejectedValueOnce(new Error('not at root')).mockResolvedValueOnce(new Uint8Array([7, 7])); // read from /tmp
    wasm.listDir.mockImplementation(async (p: string) => {
      if (p === '/') {
        return [{ name: 'other.txt', isDir: false }];
      }

      return [{ name: 'seg_output.mp4', isDir: false }];
    });
    wasm.writeFile.mockResolvedValue(undefined);
    wasm.deleteFile.mockResolvedValue(undefined);

    segmentStub.inputsAsset = {};

    const filesystem = makeFilesystem();
    const { builder, project } = makeBuilder({ ffmpeg: wasm as never, filesystem });

    await builder.buildPart(baseSection, { buildDir: '/build' });
    await builder.renderPart();

    expect(wasm.listDir).toHaveBeenCalledWith('/tmp');
    expect(filesystem.writeFile).toHaveBeenCalledWith('seg_output.mp4', expect.any(Uint8Array));
    expect(wasm.deleteFile).toHaveBeenCalledWith('/tmp/seg_output.mp4');
    expect(project.errors).toHaveLength(0);
  });

  it('finds the output in the root listing when not readable directly and not in /tmp', async () => {
    const wasm = makeWasmAdapter();
    wasm.execute.mockResolvedValue({ rc: 0 });
    segmentStub.destination = 'seg_output.mp4';
    wasm.readFile
      .mockRejectedValueOnce(new Error('not at root')) // direct read fails
      .mockResolvedValueOnce(new Uint8Array([5])); // eventual read after found-in-root
    wasm.listDir.mockImplementation(async (p: string) => {
      if (p === '/') {
        return [{ name: 'seg_output.mp4', isDir: false }];
      }
      // /tmp does not contain it
      return [{ name: 'nope.mp4', isDir: false }];
    });
    wasm.writeFile.mockResolvedValue(undefined);
    wasm.deleteFile.mockResolvedValue(undefined);

    segmentStub.inputsAsset = {};

    const filesystem = makeFilesystem();
    const { builder, project } = makeBuilder({ ffmpeg: wasm as never, filesystem });

    await builder.buildPart(baseSection, { buildDir: '/build' });
    await builder.renderPart();

    expect(filesystem.writeFile).toHaveBeenCalledWith('seg_output.mp4', expect.any(Uint8Array));
    expect(wasm.deleteFile).toHaveBeenCalledWith('seg_output.mp4');
    expect(project.errors).toHaveLength(0);
  });

  it('handles a /tmp listing error gracefully and still resolves to not-found', async () => {
    const wasm = makeWasmAdapter();
    wasm.execute.mockResolvedValue({ rc: 0 });
    wasm.readFile.mockRejectedValue(new Error('not at root')); // never found
    wasm.listDir.mockImplementation(async (p: string) => {
      if (p === '/') {
        return [{ name: 'unrelated.mp4', isDir: false }];
      }
      throw new Error('cannot list /tmp');
    });

    segmentStub.inputsAsset = {};

    const { builder, project, logger } = makeBuilder({ ffmpeg: wasm as never });

    await builder.buildPart(baseSection, { buildDir: '/build' });

    await expect(builder.renderPart()).rejects.toThrow('Failed to read output file from FFmpeg');
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('[intro][RenderPart] Could not check /tmp'));
    expect(project.errors).toContain('intro');
  });

  it('throws and records an error when the output file is not found anywhere in WASM', async () => {
    const wasm = makeWasmAdapter();
    wasm.execute.mockResolvedValue({ rc: 0 });
    wasm.readFile.mockRejectedValue(new Error('not found'));
    wasm.listDir.mockResolvedValue([{ name: 'something-else.mp4', isDir: false }]);

    segmentStub.inputsAsset = {};

    const { builder, project, logger } = makeBuilder({ ffmpeg: wasm as never });

    await builder.buildPart(baseSection, { buildDir: '/build' });

    await expect(builder.renderPart()).rejects.toThrow('Failed to read output file from FFmpeg');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Output file not found in WASM'));
    expect(project.errors).toContain('intro');
  });

  it('records an error (no success handling) when WASM ffmpeg returns rc 1', async () => {
    const wasm = makeWasmAdapter();
    wasm.execute.mockResolvedValue({ rc: 1 });

    segmentStub.inputsAsset = {};

    const { builder, project } = makeBuilder({ ffmpeg: wasm as never });

    await builder.buildPart(baseSection, { buildDir: '/build' });
    await builder.renderPart();

    expect(project.errors).toContain('intro');
    // No output transfer attempted on failure
    expect(wasm.readFile).not.toHaveBeenCalled();
  });
});

// The WASM-specific helpers each begin with an early-return guard:
//   if (!(this.ffmpegAdapter instanceof FFmpegWasmAdapter)) return ...;
// With a NATIVE (non-wasm) adapter, renderPart never routes into these methods,
// so the guard's early `return` is otherwise never exercised. Invoking the
// private helpers directly with a plain (non-wasm) adapter covers the guard.
describe('TemplateConcreteBuilder WASM-guard early returns (native adapter)', () => {
  // A plain mock adapter that is NOT an instance of the mocked FFmpegWasmAdapter.
  function makeNativeAdapter() {
    return {
      execute: vi.fn(async () => ({ rc: 0 })),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      deleteFile: vi.fn(),
      listDir: vi.fn(),
    };
  }

  it('writeInputFilesToWasm returns early and writes nothing', async () => {
    const ffmpeg = makeNativeAdapter();
    const { builder } = makeBuilder({ ffmpeg: ffmpeg as never });
    await builder.buildPart(baseSection, { buildDir: '/build' });
    // ensure there WOULD be assets to write if the guard did not short-circuit
    segmentStub.inputsAsset = { asset_a: '/assets/a.png' };

    await (builder as unknown as { writeInputFilesToWasm: () => Promise<void> }).writeInputFilesToWasm();

    expect(ffmpeg.writeFile).not.toHaveBeenCalled();
  });

  it('writeAssetToWasm returns early and reads/writes nothing', async () => {
    const ffmpeg = makeNativeAdapter();
    const { builder, filesystem } = makeBuilder({ ffmpeg: ffmpeg as never });
    await builder.buildPart(baseSection, { buildDir: '/build' });

    await (builder as unknown as { writeAssetToWasm: (k: string, p: string) => Promise<void> }).writeAssetToWasm(
      'asset_a',
      '/assets/a.png'
    );

    expect(filesystem.readFile).not.toHaveBeenCalled();
    expect(ffmpeg.writeFile).not.toHaveBeenCalled();
  });

  it('searchWasmTmpDir returns a null result for a native adapter', async () => {
    const ffmpeg = makeNativeAdapter();
    const { builder } = makeBuilder({ ffmpeg: ffmpeg as never });
    await builder.buildPart(baseSection, { buildDir: '/build' });

    const result = await (
      builder as unknown as {
        searchWasmTmpDir: (f: string) => Promise<{ data: unknown; fileLocation: unknown }>;
      }
    ).searchWasmTmpDir('seg_output.mp4');

    expect(result).toEqual({ data: null, fileLocation: null });
    expect(ffmpeg.listDir).not.toHaveBeenCalled();
  });

  it('searchWasmDirectories returns a null result for a native adapter', async () => {
    const ffmpeg = makeNativeAdapter();
    const { builder } = makeBuilder({ ffmpeg: ffmpeg as never });
    await builder.buildPart(baseSection, { buildDir: '/build' });

    const result = await (
      builder as unknown as {
        searchWasmDirectories: (f: string) => Promise<{ data: unknown; fileLocation: unknown }>;
      }
    ).searchWasmDirectories('seg_output.mp4');

    expect(result).toEqual({ data: null, fileLocation: null });
    expect(ffmpeg.listDir).not.toHaveBeenCalled();
  });

  it('findWasmOutputFile returns a null result for a native adapter', async () => {
    const ffmpeg = makeNativeAdapter();
    const { builder } = makeBuilder({ ffmpeg: ffmpeg as never });
    await builder.buildPart(baseSection, { buildDir: '/build' });

    const result = await (
      builder as unknown as {
        findWasmOutputFile: (f: string) => Promise<{ data: unknown; fileLocation: unknown }>;
      }
    ).findWasmOutputFile('seg_output.mp4');

    expect(result).toEqual({ data: null, fileLocation: null });
    expect(ffmpeg.readFile).not.toHaveBeenCalled();
  });
});
