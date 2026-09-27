// Render the showcase's use-case examples for Kiln & Co., the ceramics shop the agentic beat already
// features — both genuine LeClap engine output, from the templates in media/templates/:
//   public/captures/usecase-brand-intro.mp4   kiln-brand-intro.json — the mug rises into a kiln glow, an
//                                             iris opens onto cream, the wordmark assembles (1280x720)
//   public/captures/usecase-product-demo.mp4  kiln-product-demo.json on the shop's own walkthrough: framed
//                                             in a browser window, the camera easing onto each step (1080x1080)
// Capture the shop first (walkthrough recording + mug PNGs), from a project that has Playwright:
//   cd apps/leclap-web && node ../../packages/leclap-brand-motion/media/capture-kiln-shop.ts
//   node packages/leclap-brand-motion/media/render-use-cases.ts      (needs packages/leclap-cli built)
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { KIT, renderWithEngine } from './engine-render.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const templates = path.join(here, 'templates');
const captures = path.resolve(here, '../public/captures');
const tour = path.join(captures, 'kiln-shop/tour.mp4');
const stills = ['kiln-mug-oat.png', 'kiln-mug-sage.png', 'kiln-glow.jpg'];

for (const input of [tour, ...stills.map((still) => path.join(templates, 'stills', still))]) {
  if (!existsSync(input)) {
    throw new Error(`Missing ${path.relative(process.cwd(), input)} — run media/capture-kiln-shop.ts first.`);
  }
}

// The stills go where the templates reference them (/assets/pictures/…); the fonts pre-fill the engine's
// font cache, so the wordmark and captions never hinge on a network fetch.
const files = {
  ...Object.fromEntries(stills.map((still) => [`assets/pictures/${still}`, path.join(templates, 'stills', still)])),
  ...Object.fromEntries(
    ['PlayfairDisplay.ttf', 'Rubik.ttf'].map((font) => [`build/fonts/${font}`, path.join(KIT, 'library/fonts', font)])
  ),
};

renderWithEngine({
  template: path.join(templates, 'kiln-brand-intro.json'),
  videos: {},
  assets: [
    'musics/cafe-bossa-nova.mp3',
    'animations/light_leak.apng',
    'animations/sparkle.apng',
    'animations/shine_sweep.apng',
  ],
  files,
  out: path.join(captures, 'usecase-brand-intro.mp4'),
});

renderWithEngine({
  template: path.join(templates, 'kiln-product-demo.json'),
  videos: { walkthrough: tour },
  assets: ['musics/cafe-bossa-nova.mp3'],
  files,
  out: path.join(captures, 'usecase-product-demo.mp4'),
});

console.log('Rendered public/captures/usecase-brand-intro.mp4 and usecase-product-demo.mp4 — Kiln & Co. use cases');
