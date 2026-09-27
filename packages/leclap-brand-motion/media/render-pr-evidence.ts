// Render the pull-request evidence for the films' agentic beats: before/after walkthroughs of the
// fake Kiln & Co. shop, composed by the LeClap engine with the before/after template — both from
// examples/agentic-pr-video. Output: public/captures/pr-evidence.mp4 (--lang fr: pr-evidence.fr.mp4).
// Record the walkthroughs first (from a project that has Playwright, e.g. the web app):
//   cd apps/leclap-web && node ../../examples/agentic-pr-video/demo-shop/record.mjs \
//     --out ../../packages/leclap-brand-motion/public/captures/kiln-shop
//   node packages/leclap-brand-motion/media/render-pr-evidence.ts [--lang fr]
//
// The field values and the template's own strings come from src/agentic/copy.ts (EVIDENCE_COPY), where
// the films read them too. The French render uses the same template — only its text changes — so its
// sections, and every cue the films time off them, land exactly where the English ones do.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { langFromArgv, langSuffix } from '../audio/films.ts';
import { EVIDENCE_COPY } from '../src/agentic/copy.ts';
import { REPO, renderWithEngine } from './engine-render.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const captures = path.resolve(here, '../public/captures');
const lang = langFromArgv();
// Mirrors EVIDENCE in src/agentic/pr.tsx.
const out = path.join(captures, `pr-evidence${langSuffix(lang)}.mp4`);

renderWithEngine({
  template: path.join(REPO, 'examples/agentic-pr-video/before-after.json'),
  videos: { before: path.join(captures, 'kiln-shop/before.mp4'), after: path.join(captures, 'kiln-shop/after.mp4') },
  fields: Object.fromEntries(Object.entries(EVIDENCE_COPY.fields).map(([field, value]) => [field, value[lang]])),
  locale: lang,
  translations: Object.fromEntries(EVIDENCE_COPY.template.map((text) => [text.en, text[lang]])),
  out,
});

console.log(`Rendered ${path.relative(process.cwd(), out)} — before/after PR evidence (${lang})`);
