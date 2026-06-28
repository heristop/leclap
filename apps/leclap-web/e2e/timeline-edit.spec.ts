import { test, expect } from '@playwright/test';
import { sampleVideo } from './fixtures';

// The edit pre-pass loads ffmpeg-core from a CDN; headless Chromium's default cache can't write it
// (net::ERR_CACHE_WRITE_FAILURE), so point it at a writable on-disk cache.
test.use({ launchOptions: { args: ['--disk-cache-dir=/tmp/leclap-pw-cache', '--disk-cache-size=104857600'] } });

// Proves the timeline edit pre-pass really cuts + re-times a clip in ffmpeg.wasm: a two-segment edit
// keeping [0,2]@2× and [4,6]@1× must render an output of ≈ 2/2 + 2/1 = 3 seconds (the [2,4] gap is
// dropped, the first slice is sped up). Runs the app's own `applyVideoEdits` against a bundled sample.
//
// Needs the dev server up:  pnpm --filter @leclap/web dev   (default :5174; override with E2E_BASE_URL)

const SAMPLE = sampleVideo('earth.mp4');

test('timeline edit cuts and re-times a clip to the expected duration', async ({ page }) => {
  test.setTimeout(5 * 60 * 1000);
  await page.goto('/studio');

  const duration = await page.evaluate(async (sample) => {
    const { applyVideoEdits } = await import('/src/domain/valueObjects/videoEdits.ts');
    const buf = await (await fetch(sample)).arrayBuffer();
    const file = new File([buf], 'earth.mp4', { type: 'video/mp4' });

    const edits = {
      s0: {
        segments: [
          { id: 'a', start: 0, end: 2, speed: 2 },
          { id: 'b', start: 4, end: 6, speed: 1 },
        ],
      },
    };

    const [out] = await applyVideoEdits([file], edits, ['s0']);

    // Read the rendered clip's duration via a <video> element.
    return await new Promise<number>((resolve, reject) => {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.onloadedmetadata = () => {
        resolve(v.duration);
      };
      v.onerror = () => {
        reject(new Error('could not load edited clip'));
      };
      v.src = URL.createObjectURL(out);
    });
  }, SAMPLE);

  // Expected ≈ 3s (1s sped-up + 2s normal); allow encoder/keyframe slack.
  expect(duration).toBeGreaterThan(2.4);
  expect(duration).toBeLessThan(3.8);
});
