import { describe, it, expect, vi } from 'vitest';
import { createDrawtextProbe, ffmpegBinary, listsDrawtext, noDrawtextReason } from '@/services/geometry/drawtext-probe';
import { FFmpegAvailability } from '@/platform/ffmpeg/FFmpegDetector';

// Trimmed from a real `ffmpeg -hide_banner -filters`: the legend, the separator, then one filter a line.
const LEGEND = [
  'Filters:',
  '  T.. = Timeline support',
  '  .S. = Slice threading',
  '  | = Source or sink filter',
  '  ------',
];
const WITH_DRAWTEXT = [
  ...LEGEND,
  ' TS aap               AA->A      Apply Affine Projection algorithm to first audio stream.',
  ' T.. drawbox           V->V       Draw a colored box on the input video.',
  ' T.C drawtext          V->V       Draw text on top of video frames using libfreetype library.',
].join('\n');
const WITHOUT_DRAWTEXT = [
  ...LEGEND,
  ' T.. drawbox           V->V       Draw a colored box on the input video.',
  ' T.. drawgrid          V->V       Draw a colored grid on the input video.',
].join('\n');

describe('listsDrawtext', () => {
  it('finds drawtext in a full build’s filter list', () => {
    expect(listsDrawtext(WITH_DRAWTEXT)).toBe(true);
  });

  it('reports a build without libfreetype, which drops drawtext', () => {
    expect(listsDrawtext(WITHOUT_DRAWTEXT)).toBe(false);
  });

  // Only the filter-name column counts: a description or the legend mentioning the word is not the filter.
  it('does not match drawtext outside the filter-name column', () => {
    const mention = [...LEGEND, ' T.. overlay   VV->V   Overlay a video, e.g. one a drawtext made.'].join('\n');

    expect(listsDrawtext(mention)).toBe(false);
    expect(listsDrawtext('')).toBe(false);
  });
});

describe('ffmpegBinary', () => {
  it('runs `ffmpeg` from PATH for the system build and the reported path for ffmpeg-static', () => {
    expect(ffmpegBinary({ availability: FFmpegAvailability.SYSTEM, path: 'system' })).toBe('ffmpeg');
    expect(ffmpegBinary({ availability: FFmpegAvailability.STATIC, path: '/opt/ffmpeg-static/ffmpeg' })).toBe(
      '/opt/ffmpeg-static/ffmpeg'
    );
  });

  it('has no binary to probe for WASM or no FFmpeg at all', () => {
    expect(ffmpegBinary({ availability: FFmpegAvailability.WASM, path: 'wasm' })).toBeNull();
    expect(ffmpegBinary({ availability: FFmpegAvailability.NONE })).toBeNull();
    expect(ffmpegBinary({ availability: FFmpegAvailability.STATIC })).toBeNull();
  });
});

describe('createDrawtextProbe', () => {
  it('answers from the binary’s own filter list', async () => {
    const probe = createDrawtextProbe((binary) =>
      Promise.resolve(binary === 'ffmpeg' ? WITHOUT_DRAWTEXT : WITH_DRAWTEXT)
    );

    expect(await probe('ffmpeg')).toBe(false);
    expect(await probe('/opt/ffmpeg-static/ffmpeg')).toBe(true);
  });

  it('runs the binary once per path, however often it is asked', async () => {
    const run = vi.fn((_binary: string) => Promise.resolve(WITH_DRAWTEXT));
    const probe = createDrawtextProbe(run);

    await Promise.all([probe('ffmpeg'), probe('ffmpeg')]);
    await probe('ffmpeg');
    await probe('/other/ffmpeg');

    expect(run.mock.calls.map(([binary]) => binary)).toEqual(['ffmpeg', '/other/ffmpeg']);
  });

  // A probe that cannot run proves nothing is missing: let the render try, and fail on its own terms.
  it('assumes drawtext is there when the filter list cannot be read', async () => {
    const probe = createDrawtextProbe(() => Promise.reject(new Error('spawn EACCES')));

    expect(await probe('ffmpeg')).toBe(true);
  });
});

describe('noDrawtextReason', () => {
  it('names the binary and says how to get a build that has it', () => {
    expect(noDrawtextReason('/opt/homebrew/bin/ffmpeg')).toBe(
      'FFmpeg at /opt/homebrew/bin/ffmpeg has no drawtext filter (built without libfreetype) — ' +
        'install ffmpeg-static or a full build'
    );
  });

  it('says the system build is the one on PATH', () => {
    expect(noDrawtextReason('ffmpeg')).toMatch(/^FFmpeg at ffmpeg \(on PATH\) has no drawtext filter/);
  });
});
