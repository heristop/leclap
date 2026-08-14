// Render the LeClap social cards as PNG stills. Build-time only — run
// `pnpm --filter @leclap/brand-motion render:og` after changing the LeClapOg / LeClapSocialPreview
// compositions.
//
// Two sizes, because the two consumers crop differently:
//   • 1200x630 (1.91:1) → apps/leclap-web/public/og-image.png, the site's og:image / twitter:image.
//   • 1280x640 (2:1)    → .github/media/social-preview.png, GitHub's repo Social preview. GitHub
//     scales any upload into that box, so handing it the exact size is the only way to know what a
//     shared link will unfurl as. Uploading it is a manual step in repo Settings — there is no API.
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, selectComposition, renderStill } from '@remotion/renderer';
import { webpackOverride } from './webpack-override.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

// `scale: 2` gives the site's card a crisp 2400x1260 for high-DPI feeds. GitHub's upload is capped at
// 1 MB and is never shown above 1280x640, so that one renders 1:1 — a 2x PNG buys nothing and risks
// bouncing off the limit.
const targets = [
  { id: 'LeClapOg', out: path.resolve(here, '../../apps/leclap-web/public/og-image.png'), scale: 2 },
  { id: 'LeClapSocialPreview', out: path.resolve(here, '../../.github/media/social-preview.png'), scale: 1 },
];

await ensureBrowser();
const serveUrl = await bundle({ entryPoint: path.resolve(here, 'src/index.ts'), webpackOverride });

// Sequential (a lint-clean alternative to `await` inside a for-loop): both stills share one browser.
await targets.reduce<Promise<void>>(
  (prev, target) =>
    prev.then(async () => {
      mkdirSync(path.dirname(target.out), { recursive: true });
      const composition = await selectComposition({ serveUrl, id: target.id });

      // The last frame: clapper settled open, wordmark + tagline fully in, flash gone.
      await renderStill({
        composition,
        serveUrl,
        output: target.out,
        frame: composition.durationInFrames - 1,
        imageFormat: 'png',
        scale: target.scale,
      });

      const { scale } = target;
      console.log(`Rendered ${target.out} (${composition.width * scale}x${composition.height * scale})`);
    }),
  Promise.resolve()
);
