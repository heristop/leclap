// Render the LeClapBumper composition to the bundled bumper clip the premium-logo-bumper partial
// plays. Build-time only — run `pnpm --filter @leclap/bumper render` after changing the composition.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, selectComposition, renderMedia } from '@remotion/renderer';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../ffmpeg-video-composer/src/shared/assets/videos/leclap_bumper.mp4');

await ensureBrowser();
const serveUrl = await bundle({ entryPoint: path.resolve(here, 'src/index.ts') });
const composition = await selectComposition({ serveUrl, id: 'LeClapBumper' });
await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: out });

console.log(`Rendered ${out}`);
