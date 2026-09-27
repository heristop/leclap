// Render the showcase's "Product demos" example: the builder screen capture, edited into a square
// walkthrough (the LeClapProductDemoTake composition — eased zooms that follow the clicks, a cursor),
// then composed by the LeClap engine with the real creative-kit App Tutorial template (title card,
// STEP caption, tap pulse, outro). Output: public/captures/app-tutorial-render.mp4.
//   node media/render-product-demo.ts      (needs packages/leclap-cli built)
import path from 'node:path';
import os from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, renderMedia, selectComposition } from '@remotion/renderer';
import { webpackOverride } from '../webpack-override.ts';
import { KIT, renderWithEngine } from './engine-render.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../public/captures/app-tutorial-render.mp4');
const tmp = mkdtempSync(path.join(os.tmpdir(), 'leclap-product-demo-'));
const take = path.join(tmp, 'walkthrough.mp4');

await ensureBrowser();
const serveUrl = await bundle({ entryPoint: path.resolve(here, '../src/index.ts'), webpackOverride });

try {
  const composition = await selectComposition({ serveUrl, id: 'LeClapProductDemoTake' });
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    crf: 16,
    muted: true,
    outputLocation: take,
    concurrency: 3,
  });

  renderWithEngine({
    template: path.join(KIT, 'templates/app-tutorial.json'),
    videos: { video_1: take },
    fields: { form_1_topic: 'Add a background', form_1_step: 'Pick a photo, see it live', brand: 'LeClap' },
    assets: ['animations/tap_pulse.apng'],
    out,
  });
} finally {
  rmSync(tmp, { recursive: true, force: true });
  rmSync(serveUrl, { recursive: true, force: true });
}

console.log(`Rendered ${path.relative(process.cwd(), out)} — App Tutorial on the edited builder capture`);
