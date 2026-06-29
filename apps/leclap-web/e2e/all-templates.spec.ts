import { test, expect, type Page } from '@playwright/test';
import { sampleVideo } from './fixtures';

// End-to-end WASM compilation check for every template, against BOTH a
// fixture WITH an audio track and a video-only fixture WITHOUT one.
// Drives the real app: imports the app's own services in-page, fetches a bundled
// sample video, and runs each template through the actual FFmpeg WebAssembly
// pipeline (coreCompilationService.compileVideo), asserting a non-empty MP4.
//
// The no-audio fixture is the regression guard for the "Stream map '0:a'
// matches no streams" abort that a video-only upload triggered.
//
// Run with the dev server up:  pnpm --filter @leclap/web dev   (port 5174)
// then:                        pnpm --filter @leclap/web test:e2e

const FIXTURES = [
  { label: 'with-audio', video: sampleVideo('earth.mp4') },
  { label: 'no-audio', video: sampleVideo('earth-no-audio.mp4') },
];

// Sample values for any form field a bundled template might reference (extra keys are harmless).
const DEFAULT_FORM: Record<string, string> = {
  form_1_firstname: 'Alexandre',
  form_1_lastname: 'Mogere',
  form_1_name: 'Alexandre',
  form_1_job: 'Engineer',
  form_1_title: 'Engineer',
  form_1_question: 'What drives you',
  form_1_quote: 'Make it count',
  form_1_headline: 'We did it',
  form_1_scene1: 'Morning',
  form_1_scene2: 'Coffee',
  form_1_scene3: 'Work',
  optionA1: 'Tea',
  optionB1: 'Coffee',
  optionA2: 'Beach',
  optionB2: 'Mountains',
  optionA3: 'Cats',
  optionB3: 'Dogs',
};

type CompileResult = { ok: boolean; size: number; error?: string };

// App modules live OUTSIDE this Playwright spec — they're loaded in-page from the running Vite dev
// server by their server-absolute URL. Routing the path through a variable keeps it a runtime value
// (not a static import the bundler/linter would try to resolve from the spec's own directory).
const SERVICE = '/src/services/templateService.ts';
const COMPILE = '/src/application/usecases/coreCompilationService.ts';

async function listTemplateIds(page: Page): Promise<string[]> {
  return page.evaluate(async (servicePath) => {
    const { templateService } = await import(/* @vite-ignore */ servicePath);
    const templates = await templateService.getAllTemplates();

    return templates.map((t: { id: string }) => t.id);
  }, SERVICE);
}

async function compileTemplate(
  page: Page,
  id: string,
  formData: Record<string, string>,
  sampleVideo: string
): Promise<CompileResult> {
  return page.evaluate(runCompileInPage, { id, formData, sampleVideo, servicePath: SERVICE, compilePath: COMPILE });
}

// Serialized into the page: loads the app's services, builds one clip per project_video section, and
// compiles the template through the real WASM pipeline (capped by a timeout). Kept flat (no deep
// callback nesting) and self-contained so Playwright can stringify it.
async function runCompileInPage(args: {
  id: string;
  formData: Record<string, string>;
  sampleVideo: string;
  servicePath: string;
  compilePath: string;
}): Promise<CompileResult> {
  const { templateService } = await import(/* @vite-ignore */ args.servicePath);
  const { coreCompilationService } = await import(/* @vite-ignore */ args.compilePath);
  const buf = await (await fetch(args.sampleVideo)).arrayBuffer();
  // setTimeout's 3rd arg is passed to the callback, so reject(err) needs no inner closure.
  const timeout = new Promise<never>((_, reject) => setTimeout(reject, 300_000, new Error('TIMEOUT')));

  try {
    const template = await templateService.getTemplate(args.id);
    const sections = (template.descriptor.sections ?? []) as Array<{ type?: string }>;
    const clipCount = Math.max(1, sections.filter((s) => s.type === 'project_video').length);
    const files: File[] = [];

    for (let i = 0; i < clipCount; i += 1) files.push(new File([buf], 'earth.mp4', { type: 'video/mp4' }));

    const noop = () => {};
    const compiled = coreCompilationService.compileVideo({ template, formData: args.formData, files }, noop);
    const result = await Promise.race([compiled, timeout]);

    return { ok: true, size: result.size };
  } catch (e) {
    return { ok: false, size: 0, error: String((e as Error)?.message ?? e) };
  }
}

// Compile every template against one fixture, logging each result; returns id→outcome.
async function compileAll(page: Page, label: string, video: string): Promise<Record<string, CompileResult>> {
  await page.goto('/studio');

  const ids = await listTemplateIds(page);
  expect(ids.length).toBeGreaterThan(0);

  const results: Record<string, CompileResult> = {};

  for (const id of ids) {
    // Reload between templates to reset the in-memory template cache + FS.
    await page.goto('/studio');

    const r = await compileTemplate(page, id, DEFAULT_FORM, video);
    results[id] = r;
    console.log(`[${label}] ${r.ok ? 'PASS' : 'FAIL'} ${id}` + (r.ok ? ` (${r.size} bytes)` : ` — ${r.error}`));
  }

  return results;
}

test.describe('All templates compile in FFmpeg WASM', () => {
  for (const fixture of FIXTURES) {
    test(`every template produces a non-empty MP4 (${fixture.label})`, async ({ page }) => {
      test.setTimeout(20 * 60 * 1000);

      const results = await compileAll(page, fixture.label, fixture.video);
      const entries = Object.entries(results);
      const failed = entries.filter(([, r]) => !r.ok);
      const detail = failed.map(([id, r]) => `${id} (${r.error})`).join('; ');

      expect(failed, `[${fixture.label}] templates that failed to compile in WASM: ${detail}`).toEqual([]);
      expect(entries.every(([, r]) => r.size > 1000)).toBe(true);
    });
  }
});
