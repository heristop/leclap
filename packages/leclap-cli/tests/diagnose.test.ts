import { stripVTControlCharacters } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runFullDiagnosticsMock = vi.fn();

vi.mock('ffmpeg-video-composer', () => ({
  FFmpegDetector: { runFullDiagnostics: (...args: unknown[]) => runFullDiagnosticsMock(...args) },
}));

import { diagnose } from '../src/commands/diagnose';

type Backend = { available: boolean; version?: string; ffprobe?: boolean };

const absent: Backend = { available: false };

function reportWith(ffmpegStatus: { system: Backend; static: Backend; wasm: Backend }) {
  return {
    systemInfo: { os: 'linux x64', arch: 'x64', nodeVersion: 'v24.11.0', packageManager: 'pnpm', memoryGB: 8 },
    ffmpegStatus,
    recommendations: [],
  };
}

// No FFmpeg installed: the render falls back to ffmpeg-static.
function staticOnly(ffprobe?: boolean) {
  return reportWith({ system: absent, static: { available: true, version: '6.0', ffprobe }, wasm: absent });
}

describe('diagnose command', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number): never => {
      throw new Error(`exit:${code}`);
    }) as never);
  });

  afterEach(() => {
    logSpy.mockRestore();
    writeSpy.mockRestore();
    exitSpy.mockRestore();
  });

  async function output(report: ReturnType<typeof reportWith>): Promise<string> {
    runFullDiagnosticsMock.mockResolvedValue(report);
    await diagnose.run?.({ args: {} } as never);

    return logSpy.mock.calls.map((call: unknown[]) => stripVTControlCharacters(String(call[0]))).join('\n');
  }

  it('withholds "Ready to render." when ffmpeg-static has no ffprobe', async () => {
    const out = await output(staticOnly(false));

    expect(out).not.toContain('Ready to render.');
    expect(out).toContain('Setup required for templates with transitions, music, overlays or video clips.');
  });

  it('flags the missing ffprobe on the static backend', async () => {
    expect(await output(staticOnly(false))).toContain('✓ static 6.0 (no ffprobe)');
  });

  it('is ready to render once ffmpeg-static has an ffprobe', async () => {
    expect(await output(staticOnly(true))).toContain('Ready to render.');
  });

  // An engine from before the ffprobe check leaves the field out: nothing to flag, same verdict as before.
  it('stays ready to render when the engine does not report an ffprobe', async () => {
    expect(await output(staticOnly())).toContain('Ready to render.');
  });

  it('is ready to render on system FFmpeg, whatever ffmpeg-static lacks', async () => {
    const report = reportWith({
      system: { available: true, version: '8.1' },
      static: { available: true, version: '6.0', ffprobe: false },
      wasm: absent,
    });

    expect(await output(report)).toContain('Ready to render.');
  });
});
