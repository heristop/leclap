import { test, expect, type Page } from '@playwright/test';

// End-to-end WASM compilation check for every template, against BOTH a
// fixture WITH an audio track and a video-only fixture WITHOUT one.
// Drives the real app: imports the app's own services in-page, fetches a bundled
// sample video, and runs each template through the actual FFmpeg WebAssembly
// pipeline (coreCompilationService.compileVideo), asserting a non-empty MP4.
//
// The no-audio fixture is the regression guard for the "Stream map '0:a'
// matches no streams" abort that a video-only upload triggered.
//
// Run with the dev server up:  pnpm --filter leclap dev   (port 5174)
// then:                        pnpm --filter leclap test:e2e

const VIDEO_DIR =
  '/@fs/Users/alexandre_mogere/Workspace/ffmpeg-video-composer/packages/creative-kit/src/library/videos';

const FIXTURES = [
  { label: 'with-audio', video: `${VIDEO_DIR}/earth.mp4` },
  { label: 'no-audio', video: `${VIDEO_DIR}/earth-no-audio.mp4` },
];

// Form templates need field values; everything else compiles with no form data.
const FORM_DATA: Record<string, Record<string, string>> = {
  'sample-advanced': { form_1_firstname: 'Alexandre', form_1_lastname: 'Mogere', form_1_job: 'Engineer' },
  sample: { form_1_firstname: 'Alexandre', form_1_lastname: 'Mogere', form_1_job: 'Engineer' },
};

async function listTemplateIds(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const { templateService } = await import('/src/services/templateService.ts');
    const templates = await templateService.getAllTemplates();

    return templates.map((t: { id: string }) => t.id);
  });
}

async function compileTemplate(
  page: Page,
  id: string,
  formData: Record<string, string>,
  sampleVideo: string
): Promise<{ ok: boolean; size: number; error?: string }> {
  return page.evaluate(
    async ({ id, formData, sampleVideo }) => {
      const { templateService } = await import('/src/services/templateService.ts');
      const { coreCompilationService } = await import('/src/application/usecases/coreCompilationService.ts');
      const resp = await fetch(sampleVideo);
      const file = new File([await resp.arrayBuffer()], 'earth.mp4', { type: 'video/mp4' });
      const withTimeout = <T>(p: Promise<T>, ms: number) =>
        Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), ms))]);
      try {
        const template = await templateService.getTemplate(id);
        const result = await withTimeout(
          coreCompilationService.compileVideo({ template, formData, files: [file] }, () => {}),
          120000
        );

        return { ok: true, size: result.size };
      } catch (e) {
        return { ok: false, size: 0, error: String((e as Error)?.message ?? e) };
      }
    },
    { id, formData, sampleVideo }
  );
}

test.describe('All templates compile in FFmpeg WASM', () => {
  for (const fixture of FIXTURES) {
    test(`every template produces a non-empty MP4 (${fixture.label})`, async ({ page }) => {
      test.setTimeout(20 * 60 * 1000);
      await page.goto('/builder');

      const ids = await listTemplateIds(page);
      expect(ids.length).toBeGreaterThan(0);

      const results: Record<string, { ok: boolean; size: number; error?: string }> = {};

      for (const id of ids) {
        // Reload between templates to reset the in-memory template cache + FS.
        await page.goto('/builder');
        results[id] = await compileTemplate(page, id, FORM_DATA[id] ?? {}, fixture.video);
        console.log(
          `[${fixture.label}] ${results[id].ok ? 'PASS' : 'FAIL'} ${id}` +
            (results[id].ok ? ` (${results[id].size} bytes)` : ` — ${results[id].error}`)
        );
      }

      const failed = Object.entries(results).filter(([, r]) => !r.ok);
      expect(
        failed,
        `[${fixture.label}] templates that failed to compile in WASM: ${failed
          .map(([id, r]) => `${id} (${r.error})`)
          .join('; ')}`
      ).toEqual([]);

      for (const [, r] of Object.entries(results)) {
        expect(r.size).toBeGreaterThan(1000);
      }
    });
  }
});
