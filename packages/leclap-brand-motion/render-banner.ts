// Render the wide LeClap logotype banner as a PNG still, then a WebP beside it.
//   pnpm --filter @leclap/brand-motion render:banner
// Output lands in ./out; copy the .webp wherever it's needed (link-in-bio card, README header).
// Rendered at scale 2 (2400x720) so it stays crisp on high-DPI screens after downscaling.
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, selectComposition, renderStill } from '@remotion/renderer';
import { webpackOverride } from './webpack-override.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, 'out');
const png = path.resolve(outDir, 'leclap-banner.png');
const webp = path.resolve(outDir, 'leclap-banner.webp');

mkdirSync(outDir, { recursive: true });
await ensureBrowser();
const serveUrl = await bundle({ entryPoint: path.resolve(here, 'src/index.ts'), webpackOverride });
const composition = await selectComposition({ serveUrl, id: 'LeClapBanner' });

await renderStill({ composition, serveUrl, output: png, imageFormat: 'png', frame: 0, scale: 2 });

// Down to the 1200x360 the cards actually use, as WebP: same trade the other banners in the
// link-in-bio assets folder make (a few tens of KB rather than a few hundred).
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-vf', 'scale=1200:-2', '-q:v', '82', webp], {
  stdio: 'inherit',
});

console.log(`Rendered ${png} (${composition.width * 2}x${composition.height * 2}) + ${path.basename(webp)}`);
