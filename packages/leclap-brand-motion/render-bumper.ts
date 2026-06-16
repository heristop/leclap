// Render the parametrized LeClap brand bumper to an arbitrary mp4 path with custom wordmark/tagline.
// Used by the MCP `render_remotion_bumper` tool (spawned as a subprocess) and runnable by hand:
//   node render-bumper.ts --out /tmp/intro.mp4 --orientation landscape --wordmark "ACME" --tagline "Ship it"
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, selectComposition, renderMedia } from '@remotion/renderer';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);

  return i === -1 ? undefined : process.argv[i + 1];
}

const out = arg('out');

if (!out) {
  console.error(
    'Usage: node render-bumper.ts --out <path.mp4> [--style clapper|kinetic] [--orientation landscape|portrait] [--wordmark <s>] [--tagline <s>]'
  );
  process.exit(1);
}

const orientation = arg('orientation') === 'portrait' ? 'portrait' : 'landscape';
// Animation style → composition family. `clapper` (logo clap) | `kinetic` (per-letter typography).
const base = arg('style') === 'kinetic' ? 'LeClapKinetic' : 'LeClapBrandMotion';
const compositionId = orientation === 'portrait' ? `${base}Portrait` : base;
const inputProps = {
  ...(arg('wordmark') ? { wordmark: arg('wordmark') } : {}),
  ...(arg('tagline') ? { tagline: arg('tagline') } : {}),
};

const here = path.dirname(fileURLToPath(import.meta.url));

await ensureBrowser();
const serveUrl = await bundle({ entryPoint: path.resolve(here, 'src/index.ts') });
const composition = await selectComposition({ serveUrl, id: compositionId, inputProps });
await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: out, inputProps });

// One machine-readable line on stdout so the caller can capture the result.
process.stdout.write(
  `${JSON.stringify({ path: out, width: composition.width, height: composition.height, durationSeconds: composition.durationInFrames / composition.fps })}\n`
);
