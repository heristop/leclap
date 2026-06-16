// Render the LeClapBrandMotion composition to the bundled clip the logo-bumper partial plays.
// Build-time only — run `pnpm --filter @leclap/brand-motion render` after changing the composition.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, selectComposition, renderMedia } from '@remotion/renderer';

const here = path.dirname(fileURLToPath(import.meta.url));
const videosDir = path.resolve(here, '../leclap-creative-kit/src/library/videos');

const targets = [
  { id: 'LeClapBrandMotion', file: 'leclap_bumper.mp4' },
  { id: 'LeClapBrandMotionPortrait', file: 'leclap_bumper_portrait.mp4' },
];

await ensureBrowser();
const serveUrl = await bundle({ entryPoint: path.resolve(here, 'src/index.ts') });

await Promise.all(
  targets.map(async (target) => {
    const out = path.resolve(videosDir, target.file);
    const composition = await selectComposition({ serveUrl, id: target.id });
    await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: out });
    console.log(`Rendered ${out}`);
  })
);
