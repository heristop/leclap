import { CoreCompilationService } from './CoreCompilationService';
import * as Leclap from '@/modules/leclap-ffmpeg';
import * as FileSystem from 'expo-file-system/legacy';
import { compileReactNative } from 'ffmpeg-video-composer/reactnative';
import type { CompileInput } from './CompileService';

// The app's type program uses vitest globals (declarations.d.ts), but this colocated test
// executes under jest (ts-jest, transpile-only), so the jest runtime value is typed locally.
type MockFn = ((...args: never[]) => unknown) & {
  mock: { calls: unknown[][] };
  mockImplementation(impl: (...args: never[]) => unknown): MockFn;
  mockResolvedValue(value: unknown): MockFn;
};

declare const jest: {
  mock(moduleName: string, factory: () => unknown): void;
  fn(impl?: (...args: never[]) => unknown): MockFn;
  clearAllMocks(): void;
};

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('@/modules/leclap-ffmpeg', () => ({
  run: jest.fn(),
  probe: jest.fn(),
  cancel: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  makeDirectoryAsync: jest.fn().mockResolvedValue(null),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 1024 }),
  copyAsync: jest.fn().mockResolvedValue(null),
}));

// expo-asset and the media catalog pull in Metro-bundled `require('*.mp3')` assets that ts-jest
// can't resolve — mock both so the bundled-music staging path runs without real binaries.
jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: jest.fn(() => ({
      downloadAsync: jest.fn().mockResolvedValue({
        localUri: 'file:///asset/go-by-ocean.mp3',
        uri: 'file:///asset/go-by-ocean.mp3',
      }),
    })),
  },
}));

jest.mock('@/src/data/mediaCatalog', () => ({
  MUSIC_ASSETS: { 'go-by-ocean.mp3': 42 },
  FONT_ASSETS: { 'BebasNeue.ttf': 7 },
  VIDEO_ASSETS: { 'leclap_bumper.mp4': 99 },
}));

jest.mock('ffmpeg-video-composer/reactnative', () => ({
  compileReactNative: jest.fn(),
}));

const input = { descriptor: { sections: [] }, clips: {} } as unknown as CompileInput;

beforeEach(() => jest.clearAllMocks());

describe('CoreCompilationService abort wiring', () => {
  it('forwards an abort to the native cancel while compiling', async () => {
    const controller = new AbortController();

    (compileReactNative as unknown as MockFn).mockImplementation(async () => {
      controller.abort();
      return '/cache/out.mp4';
    });

    await new CoreCompilationService().compile(input, { signal: controller.signal });

    expect(Leclap.cancel).toHaveBeenCalledTimes(1);
  });

  it('does not cancel after the compile finished', async () => {
    const controller = new AbortController();

    (compileReactNative as unknown as MockFn).mockResolvedValue('/cache/out.mp4');

    await new CoreCompilationService().compile(input, { signal: controller.signal });
    controller.abort();

    expect(Leclap.cancel).not.toHaveBeenCalled();
  });
});

describe('CoreCompilationService bundled-asset staging', () => {
  const withMusic = {
    descriptor: { sections: [], global: { music: { name: 'go-by-ocean.mp3' } } },
    clips: {},
  } as unknown as CompileInput;

  const copiedTo = (): string[] =>
    (FileSystem.copyAsync as unknown as MockFn).mock.calls.map((c) => (c[0] as { to: string }).to);

  it('stages the bundled fonts and default music into the assets dir when not present', async () => {
    // Not yet staged → the core would otherwise abort (missing font → drawtext rc=-22, or
    // "Music URL is not provided" for the track).
    (FileSystem.getInfoAsync as unknown as MockFn).mockResolvedValue({ exists: false });
    (compileReactNative as unknown as MockFn).mockResolvedValue('/cache/out.mp4');

    await new CoreCompilationService().compile(withMusic);

    expect(copiedTo()).toContain('file:///cache/leclap-assets/fonts/BebasNeue.ttf');
    expect(copiedTo()).toContain('file:///cache/leclap-assets/musics/go-by-ocean.mp3');
    // The brand bumper must be staged so the core resolves it locally instead of downloading its
    // canonical URL (which 404s on-device → AVERROR_INVALIDDATA).
    expect(copiedTo()).toContain('file:///cache/leclap-assets/videos/leclap_bumper.mp4');
  });

  it('skips copying when the assets are already staged', async () => {
    (FileSystem.getInfoAsync as unknown as MockFn).mockResolvedValue({ exists: true });
    (compileReactNative as unknown as MockFn).mockResolvedValue('/cache/out.mp4');

    await new CoreCompilationService().compile(withMusic);

    expect((FileSystem.copyAsync as unknown as MockFn).mock.calls.length).toBe(0);
  });
});
