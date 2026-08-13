import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

// Surfaces in clients (e.g. Claude Desktop) as a `/compose-video` affordance. It primes the agent
// to author a PREMIUM, deterministic, on-device-safe template and to iterate with validate_template
// before the slower compose_video render.
const argsSchema = z.object({
  goal: z
    .string()
    .optional()
    .describe('What to make, e.g. "a 15s premium title card for Emily Parker, Frontend Developer".'),
  orientation: z
    .enum(['landscape', 'portrait', 'square'])
    .optional()
    .describe('landscape (16:9), portrait (9:16) or square (1:1).'),
});

type GuideArgs = { goal?: string; orientation?: 'landscape' | 'portrait' | 'square' };

// On-device FFmpeg is an LGPL build (scripts/ffmpeg/common.sh, --disable-gpl). Authoring against this
// set keeps the output identical across React Native, browser WASM, and the server. GPL filters (eq,
// boxblur, geq) are absent — the engine auto-remaps `eq`→`lutyuv` and blur is `gblur` — so prefer the
// structured `grade`/`look`/`motion` fields below over raw GPL filters.
const ON_DEVICE_FILTERS =
  'scale, crop, pad, format, fps, trim, setpts, fade, drawtext, overlay, concat, xfade, loop, tile, ' +
  'drawbox, gblur, hue, vignette, hflip, vflip, rotate, transpose, negate, colorchannelmixer, ' +
  'colorbalance, curves, zoompan, lutyuv, sidechaincompress, aresample, aformat, amix, afade, ' +
  'acrossfade, afftdn, volume, color, sine, gradients';

const BUNDLED_FONTS = 'BebasNeue, Oswald, PlayfairDisplay, Pacifico, Rubik, RobotoMono';

function buildText(args: GuideArgs): string {
  const goal = args.goal?.trim() ? args.goal.trim() : 'the video the user describes';
  const orientation =
    args.orientation ?? 'the orientation the user wants (landscape 16:9, portrait 9:16 or square 1:1)';

  return [
    'You are composing DETERMINISTIC, on-device video with the LeClap engine — the same JSON template',
    'renders identically on a phone (React Native), in the browser (WASM), and on a server. This is the',
    'opposite of generative video: same input → byte-reproducible output, no upload, no server required.',
    '',
    `Goal: ${goal}. Orientation: ${orientation}.`,
    '',
    'Workflow:',
    '1. Call get_template_schema for the authoritative shape and the authoring guide, then author a',
    '   descriptor for the goal from scratch.',
    '2. Make it premium: lean on typography, color grading, and timing — use the building blocks below.',
    '3. Call validate_template (instant, no render) and fix any issues + confirm the required clips/fields.',
    '4. Call compose_video and read the returned outputPath.',
    '',
    'Premium animated intro (bring your own Remotion): if you have a Remotion project, call',
    'render_remotion_clip with its entry + a compositionId (+ optional inputProps) for motion graphics the',
    'FFmpeg filtergraph cannot produce — it returns an mp4 clip path. Add a leading { type: "project_video",',
    'name: "intro" } section and pass that path via compose_video\'s userVideoPaths.intro, so FFmpeg composites',
    'the Remotion intro in front of your scenes. It needs @remotion/* (optional) and is a design-time render',
    '(headless Chromium), not an on-device path; everything else stays on-device.',
    '',
    'Premium building blocks — PREFER the structured fields (they lower to on-device-safe filters and',
    'stay legible) over hand-rolled filtergraphs:',
    '  - text: `titleCard` / `lowerThird` / `caption` sugar with `accent`, `reveal` ("rise"/"fade"),',
    '    and `effect: { shadow, outline }` — a staged, on-brand reveal without writing `alpha` expressions.',
    '  - colour: a section `look` (named preset, e.g. "cinematic"/"warm-film"/"teal-orange") plus a manual',
    '    `grade` — `colorBalance` (shadows/midtones/highlights r/g/b) and `curvesPreset` (e.g.',
    '    "increase_contrast", "vintage") are LGPL and run everywhere.',
    '  - motion: a section `motion` array — `kenburns` (direction+intensity push-in), `rotate`, `flip`,',
    '    `crop`. Per-section `options.speed` retimes a clip (2 = half-speed slow-mo, 0.5 = 2× fast).',
    '  - audio: `global.audio` with `musicVolume`, `normalize: "loudnorm"`, and `ducking`',
    '    ({ threshold, ratio, attack, release }) so music dips under speech — on-device-safe.',
    '  - background: full-frame `drawbox` (t:fill) for a solid base, layered band drawboxes or `gradients`',
    '    for depth, `vignette` for a cinematic edge.',
    '  - motion between clips: `xfade`; per-clip in/out: `fade`.',
    '  - raw-filter escape hatch (LGPL on-device allowlist, use only these when you must hand-roll):',
    `    ${ON_DEVICE_FILTERS}`,
    '  - NOT available on-device (GPL, dropped by --disable-gpl): `eq` (auto-remapped to `lutyuv`) and',
    '    `boxblur` (use `gblur`). Everything else the core emits — including `curves`, `colorbalance`,',
    '    `zoompan`, `gradients`, `geq`, `sidechaincompress` — is LGPL and compiled in.',
    `  bundled fonts (bare names, no path): ${BUNDLED_FONTS}.`,
    '',
    'Portrait is 720x1280 (9:16); landscape is 1280x720 (16:9); square is 1080x1080 (1:1). project_video sections need a user clip',
    'supplied at compose time; color/text-only templates need no upload at all.',
  ].join('\n');
}

export function registerComposeGuide(server: McpServer): void {
  server.registerPrompt(
    'compose-video',
    {
      title: 'Compose a premium video',
      description:
        'Guided authoring for a premium, deterministic, on-device-safe LeClap template — primes the ' +
        'schema, the premium filter/typography recipes, and the validate→compose loop.',
      argsSchema,
    },
    (args: GuideArgs) => ({
      messages: [
        {
          role: 'user',
          content: { type: 'text', text: buildText(args) },
        },
      ],
    })
  );
}
