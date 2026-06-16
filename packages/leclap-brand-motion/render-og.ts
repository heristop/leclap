// Render the LeClap social card (og:image / twitter:image) as a 1200x630 PNG still.
// Build-time only — run `pnpm --filter @leclap/brand-motion render:og` after changing the
// LeClapOg composition. Output lands in the web app's public/ so Vite serves it at /og-image.png.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, selectComposition, renderStill } from '@remotion/renderer';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../../apps/leclap-web/public/og-image.png');

await ensureBrowser();
const serveUrl = await bundle({ entryPoint: path.resolve(here, 'src/index.ts') });
const composition = await selectComposition({ serveUrl, id: 'LeClapOg' });

// The last frame: clapper settled open, wordmark + tagline fully in, flash gone.
// scale: 2 → a crisp 2400x1260 (the recommended 1.91:1 ratio at 2x for high-DPI feeds).
await renderStill({
  composition,
  serveUrl,
  output: out,
  frame: composition.durationInFrames - 1,
  imageFormat: 'png',
  scale: 2,
});

console.log(`Rendered ${out}`);
