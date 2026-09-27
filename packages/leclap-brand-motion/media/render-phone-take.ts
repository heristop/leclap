// Render what the phone shows after "Create my video" in the showcase: the real Present Yourself
// (Portrait) creative-kit template, composed by the LeClap engine on a clip of someone filming
// themselves. Output: public/captures/present-yourself-render.mp4 — genuine engine output, not a mock.
//   node media/render-phone-take.ts                (needs packages/leclap-cli built: pnpm --filter @leclap/cli build)
//   node media/render-phone-take.ts --name Sam --from 3.2
//
// Source footage: public/captures/selfie-wave-source.mp4 — Pexels video 6965115, "A woman waving her
// hand while talking" (Pexels License: free to use, no attribution required). `--from` picks the 6s
// the template records (its video section lasts 6s); the showcase's recording screen previews the
// seconds just before it, so the take starts where the preview's countdown ends.
import path from 'node:path';
import os from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { KIT, cutClip, renderWithEngine } from './engine-render.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(here, '../public/captures/selfie-wave-source.mp4');
const out = path.resolve(here, '../public/captures/present-yourself-render.mp4');

const argValue = (flag: string): string | undefined =>
  process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : undefined;

const NAME = argValue('--name') ?? 'Alex';
const FROM = Number(argValue('--from') ?? 3.2);
const TAKE_SECONDS = 6;

const tmp = mkdtempSync(path.join(os.tmpdir(), 'leclap-phone-take-'));
const take = path.join(tmp, 'take.mp4');

try {
  cutClip(source, FROM, TAKE_SECONDS, take);
  renderWithEngine({
    template: path.join(KIT, 'templates/present-yourself-portrait.json'),
    videos: { video_1: take },
    fields: { form_1_firstname: NAME },
    assets: ['animations/glow_border.apng', 'videos/leclap_bumper_portrait.mp4'],
    out,
  });
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(
  `Rendered ${path.relative(process.cwd(), out)} — Present Yourself (Portrait), "${NAME}", take ${FROM}–${FROM + TAKE_SECONDS}s`
);
