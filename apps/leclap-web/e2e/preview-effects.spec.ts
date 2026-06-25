import { test, expect } from '@playwright/test';

// Regression coverage for the builder's "Preview render" through ffmpeg.wasm with the ffmpeg-feature
// sugar (LUT looks, chroma key, lower-third + caption text effects) and with TWO video sections. The
// browser perf-timer crash (`reading 'bigint'`) used to break every browser compilation before any
// ffmpeg ran; this exercises the real WASM path so a regression there — or an effect that fails to
// compile on the 6.x core — is caught. Drives the same in-page preview functions the button uses.
//
// Needs the dev server up:  pnpm --filter @leclap/web dev   (default :5174; override with E2E_BASE_URL)

// The preview loads ffmpeg-core from a CDN; headless Chromium's default cache can't write it
// (net::ERR_CACHE_WRITE_FAILURE), so point it at a writable on-disk cache.
test.use({ launchOptions: { args: ['--disk-cache-dir=/tmp/leclap-pw-cache', '--disk-cache-size=104857600'] } });

// Compile a single-video preview after shallow-merging `patch` (a serializable object) onto the
// default first video section. The patch is passed as evaluate data — no functions cross the bridge.
async function compileWithPatch(
  page: import('@playwright/test').Page,
  patch: Record<string, unknown>
): Promise<number> {
  return page.evaluate(async (sectionPatch) => {
    const { toEditorState } = await import('/src/presentation/components/admin/templateEditorModel.ts');
    const { buildPreviewPlan } = await import('/src/presentation/components/admin/editor/previewRender.ts');
    const { generatePlaceholderClips } = await import('/src/presentation/components/admin/editor/placeholderClips.ts');
    const { coreCompilationService } = await import('/src/application/usecases/coreCompilationService.ts');

    const state = toEditorState(null);
    Object.assign(state.sections[0] as Record<string, unknown>, sectionPatch);

    const plan = buildPreviewPlan(state);
    const files = await generatePlaceholderClips(state, plan.clipCount);
    const out = await coreCompilationService.compileVideo(
      { template: plan.template, formData: plan.formData, files, videoConfig: plan.videoConfig, preset: 'ultrafast' },
      () => {}
    );

    return out.size;
  }, patch);
}

test.describe('Preview render — ffmpeg-feature sugar on ffmpeg.wasm', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/templates/new');
  });

  test('a LUT look (lut3d) compiles on the WASM core', async ({ page }) => {
    test.setTimeout(6 * 60 * 1000);
    const size = await compileWithPatch(page, { look: 'teal-orange' });
    expect(size).toBeGreaterThan(1000);
  });

  test('chroma key (colorkey) compiles on the WASM core', async ({ page }) => {
    test.setTimeout(6 * 60 * 1000);
    const size = await compileWithPatch(page, {
      chromaKey: { color: '#00FF00', similarity: 0.3, blend: 0.1, background: '#102030' },
    });
    expect(size).toBeGreaterThan(1000);
  });

  test('lower-third + caption text effects (shadow/outline) compile on the WASM core', async ({ page }) => {
    test.setTimeout(6 * 60 * 1000);
    const size = await compileWithPatch(page, {
      lowerThird: { title: { en: 'Name' }, subtitle: { en: 'Role' }, accent: '#E0884C', effect: { shadow: true, outline: true } },
      caption: { text: 'Hello', effect: { shadow: true, outline: true } },
    });
    expect(size).toBeGreaterThan(1000);
  });

  test('a library image overlay on a video section compiles (library:// is resolved)', async ({ page }) => {
    test.setTimeout(6 * 60 * 1000);
    // Regression for the preview skipping library-marker resolution: an author-added library image
    // element reached the engine as a raw `library://<id>` url it could not fetch, aborting the segment
    // with "Output file not found in WASM".
    const size = await page.evaluate(async () => {
      const { toEditorState } = await import('/src/presentation/components/admin/templateEditorModel.ts');
      const { buildPreviewPlan } = await import('/src/presentation/components/admin/editor/previewRender.ts');
      const { generatePlaceholderClips } = await import('/src/presentation/components/admin/editor/placeholderClips.ts');
      const { coreCompilationService } = await import('/src/application/usecases/coreCompilationService.ts');
      const { BACKGROUND_LIBRARY } = await import('/src/data/mediaCatalog.ts');

      const state = toEditorState(null);
      const libId = BACKGROUND_LIBRARY[0].id;
      (state.sections[0] as Record<string, unknown>).images = [{ id: 'img1', choice: { source: 'library', id: libId } }];

      const plan = buildPreviewPlan(state);
      const files = await generatePlaceholderClips(state, plan.clipCount);
      const out = await coreCompilationService.compileVideo(
        { template: plan.template, formData: plan.formData, files, videoConfig: plan.videoConfig, preset: 'ultrafast' },
        () => {}
      );

      return out.size;
    });
    expect(size).toBeGreaterThan(1000);
  });

  test('two video sections preview without losing the second segment output', async ({ page }) => {
    test.setTimeout(8 * 60 * 1000);
    const size = await page.evaluate(async () => {
      const { toEditorState, newSection } = await import('/src/presentation/components/admin/templateEditorModel.ts');
      const { buildPreviewPlan } = await import('/src/presentation/components/admin/editor/previewRender.ts');
      const { generatePlaceholderClips } = await import('/src/presentation/components/admin/editor/placeholderClips.ts');
      const { coreCompilationService } = await import('/src/application/usecases/coreCompilationService.ts');

      const state = toEditorState(null);
      state.sections.push(newSection('video')); // a second video section (video_2)

      const plan = buildPreviewPlan(state);
      const files = await generatePlaceholderClips(state, plan.clipCount);
      const out = await coreCompilationService.compileVideo(
        { template: plan.template, formData: plan.formData, files, videoConfig: plan.videoConfig, preset: 'ultrafast' },
        () => {}
      );

      return out.size;
    });
    expect(size).toBeGreaterThan(1000);
  });
});
