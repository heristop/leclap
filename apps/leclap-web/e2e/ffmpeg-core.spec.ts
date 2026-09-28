import { test, expect } from '@playwright/test';
import { FFMPEG_CORE_VERSION } from 'ffmpeg-video-composer/src/platform/ffmpeg/ffmpeg-core.ts';
import { sampleVideo } from './fixtures';

// The ffmpeg.wasm core is self-hosted: the trim/crop pre-pass and the render engine both load the one
// version this origin serves under /ffmpeg-core/<version>/, and nothing comes from a CDN. Runs the app's own
// edit pass and then a preview compile in-page, and checks every request the page made on the way.
//
// Needs the dev server up:  pnpm --filter @leclap/web dev   (default :5174; override with E2E_BASE_URL)

const SAMPLE = sampleVideo('earth.mp4');

test('the trim pass and the render load one self-hosted ffmpeg core', async ({ page, baseURL }) => {
  test.setTimeout(8 * 60 * 1000);
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));

  await page.goto('/templates/new');

  const result = await page.evaluate(async (sample) => {
    try {
      const { applyVideoEdits } = await import('/src/domain/valueObjects/videoEdits.ts');
      const { toEditorState } = await import('/src/presentation/components/admin/templateEditorModel.ts');
      const { buildPreviewPlan } = await import('/src/presentation/components/admin/editor/previewRender.ts');
      const { generatePlaceholderClips } =
        await import('/src/presentation/components/admin/editor/placeholderClips.ts');
      const { coreCompilationService } = await import('/src/application/usecases/coreCompilationService.ts');

      const clip = new File([await (await fetch(sample)).arrayBuffer()], 'earth.mp4', { type: 'video/mp4' });
      const [trimmed] = await applyVideoEdits([clip], { s0: { trim: { start: 1, end: 3 } } }, ['s0']);

      const state = toEditorState(null);
      const plan = buildPreviewPlan(state);
      const files = await generatePlaceholderClips(state, plan.clipCount);
      const rendered = await coreCompilationService.compileVideo(
        { template: plan.template, formData: plan.formData, files, videoConfig: plan.videoConfig, preset: 'ultrafast' },
        () => {}
      );

      return { trimmed: trimmed === clip ? 0 : trimmed.size, rendered: rendered.size };
    } catch (error) {
      return { error: String(error) };
    }
  }, SAMPLE);

  // The served core files (not the dev server's own ffmpeg-core.ts source modules).
  const coreRequests = requests.filter((url) => URL.canParse(url) && new URL(url).pathname.startsWith('/ffmpeg-core/'));

  expect(requests.filter((url) => /unpkg\.com|jsdelivr\.net/.test(url))).toEqual([]);
  expect(result).toEqual({ trimmed: expect.any(Number), rendered: expect.any(Number) });
  expect(result.trimmed).toBeGreaterThan(1000);
  expect(result.rendered).toBeGreaterThan(1000);
  // Both passes asked this origin, for the same version.
  expect(coreRequests.length).toBeGreaterThan(0);
  expect(new Set(coreRequests.map((url) => url.slice(0, url.lastIndexOf('/'))))).toEqual(
    new Set([`${new URL(baseURL!).origin}/ffmpeg-core/${FFMPEG_CORE_VERSION}`])
  );
});
