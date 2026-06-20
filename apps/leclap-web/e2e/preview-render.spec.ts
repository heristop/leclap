import { test, expect } from '@playwright/test';

// Exercises the admin editor's "Preview render" (fast draft) on /templates/new: it compiles the current
// descriptor through ffmpeg.wasm with placeholder clips, each section clamped to ≤3s at the ultrafast
// preset. Two angles: (1) drive the real button through the UI; (2) call the same preview functions
// in-page. Both cover the visual section kinds — video + color + image backgrounds.
//
// Needs the dev server up:  pnpm --filter @leclap/web dev   (default :5174; override with E2E_BASE_URL)

// The preview loads ffmpeg-core from a CDN; headless Chromium's default cache can't write it
// (net::ERR_CACHE_WRITE_FAILURE), so point it at a writable on-disk cache.
test.use({ launchOptions: { args: ['--disk-cache-dir=/tmp/leclap-pw-cache', '--disk-cache-size=104857600'] } });

// Insert a scene through the timeline's "Add scene" menu (there can be several add tiles → use the last).
async function addScene(page: import('@playwright/test').Page, label: string): Promise<void> {
  await page.getByRole('button', { name: 'Add scene' }).last().click();
  const menu = page.getByRole('menu', { name: 'Add scene' });
  await expect(menu).toBeVisible();
  await menu.getByRole('menuitem', { name: label }).click();
  await expect(menu).toBeHidden();
}

test('Preview render compiles a video + color + image template from the button', async ({ page }) => {
  test.setTimeout(8 * 60 * 1000);
  await page.goto('/templates/new');

  // A fresh template already has one video section; add a color and an image background scene.
  await addScene(page, 'Color background');
  await addScene(page, 'Background image');

  await page.getByRole('button', { name: 'Render a preview of this template with sample footage' }).click();

  // The render dialog opens and shows progress while ffmpeg.wasm works.
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('progressbar')).toBeVisible();

  // On success the compiled draft plays in the dialog and a download link appears.
  const video = dialog.locator('video');
  await expect(video).toBeVisible({ timeout: 7 * 60 * 1000 });
  await expect(page.getByRole('link', { name: /Download draft/i })).toBeVisible();

  // Confirm a real, playable MP4 (not an empty/zero-length blob).
  await expect
    .poll(async () => video.evaluate((v: HTMLVideoElement) => v.readyState), { timeout: 30_000 })
    .toBeGreaterThanOrEqual(1);
  const duration = await video.evaluate((v: HTMLVideoElement) => v.duration);
  expect(duration).toBeGreaterThan(0);

  // The render must not have surfaced an error alert.
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('Preview plan compiles a non-empty MP4 in-page (video + color + image)', async ({ page }) => {
  test.setTimeout(8 * 60 * 1000);
  await page.goto('/templates/new');

  const size = await page.evaluate(async () => {
    const { toEditorState, newSection } = await import('/src/presentation/components/admin/templateEditorModel.ts');
    const { buildPreviewPlan } = await import('/src/presentation/components/admin/editor/previewRender.ts');
    const { generatePlaceholderClips } = await import('/src/presentation/components/admin/editor/placeholderClips.ts');
    const { coreCompilationService } = await import('/src/application/usecases/coreCompilationService.ts');

    const state = toEditorState(null);
    state.sections.push(newSection('color'), newSection('image'));

    const plan = buildPreviewPlan(state);
    const files = await generatePlaceholderClips(state, plan.clipCount);
    const out = await coreCompilationService.compileVideo(
      {
        template: plan.template,
        formData: plan.formData,
        files,
        videoConfig: plan.videoConfig,
        preset: 'ultrafast',
      },
      () => {}
    );

    return out.size;
  });

  expect(size).toBeGreaterThan(1000);
});
