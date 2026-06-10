import { CoreCompilationService } from './CoreCompilationService';
import * as Leclap from '@/modules/leclap-ffmpeg';
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
  fn(): MockFn;
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
