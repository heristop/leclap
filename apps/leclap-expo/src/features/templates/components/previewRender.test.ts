import { previewRender } from './previewRender';
import { compileHybrid } from '@/src/services/compile/compileHybrid';
import { newSection, toEditorState } from '../model/templateEditorModel';

// Runs under jest (ts-jest), but the app's type program uses vitest globals, so the jest runtime
// value/type is declared locally (mirrors CoreCompilationService.test.ts).
type MockFn = ((...args: never[]) => unknown) & {
  mock: { calls: unknown[][] };
  mockResolvedValue(value: unknown): MockFn;
};

declare const jest: {
  mock(moduleName: string, factory: () => unknown): void;
  fn(): MockFn;
};

jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: () => ({ downloadAsync: async () => ({ localUri: 'file:///sample.mp4', uri: 'file:///sample.mp4' }) }),
  },
}));

jest.mock('@/src/services/compile/compileHybrid', () => ({ compileHybrid: jest.fn() }));

describe('previewRender', () => {
  it('fills every project_video section with the placeholder clip, then compiles on-device', async () => {
    const mockedCompile = compileHybrid as unknown as MockFn;
    mockedCompile.mockResolvedValue({ success: true, outputUri: 'file:///out.mp4' });

    const state = { ...toEditorState(null), name: 'Draft', sections: [newSection('video')] };
    // Inject a stub module id so the test never requires the real .mp4 asset (jest can't parse it).
    const result = await previewRender(state, 0);

    expect(result.success).toBe(true);
    expect(result.outputUri).toBe('file:///out.mp4');

    const [, recordedVideos] = mockedCompile.mock.calls[0] as [
      unknown,
      Record<string, { path: string; orientation: string }>,
    ];
    const keys = Object.keys(recordedVideos);

    expect(keys).toHaveLength(1);
    expect(recordedVideos[keys[0]].path).toBe('file:///sample.mp4');
    expect(recordedVideos[keys[0]].orientation).toBe(state.orientation);
  });
});
