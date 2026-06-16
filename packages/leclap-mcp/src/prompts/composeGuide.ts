import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// Surfaces in clients (e.g. Claude Desktop) as a `/compose-video` affordance. It primes the agent
// to author a PREMIUM, deterministic, on-device-safe template and to iterate with validate_template
// before the slower compose_video render.
const argsShape = {
  goal: z
    .string()
    .optional()
    .describe('What to make, e.g. "a 15s premium title card for Emily Parker, Frontend Developer".'),
  orientation: z.enum(['landscape', 'portrait']).optional().describe('landscape (16:9) or portrait (9:16).'),
};

type GuideArgs = { goal?: string; orientation?: 'landscape' | 'portrait' };

// On-device FFmpeg ships a fixed filter allowlist (scripts/ffmpeg/common.sh). Authoring against it
// keeps the output identical across React Native, browser WASM, and the server.
const ON_DEVICE_FILTERS =
  'scale, crop, pad, fade, drawtext, overlay, concat, xfade, boxblur, drawbox, eq, gblur, hue, ' +
  'vignette, rotate, transpose, colorchannelmixer, color, amix, afade, acrossfade, volume';

const BUNDLED_FONTS = 'BebasNeue, Oswald, PlayfairDisplay, Pacifico, Rubik, RobotoMono';

function buildText(args: GuideArgs): string {
  const goal = args.goal?.trim() ? args.goal.trim() : 'the video the user describes';
  const orientation = args.orientation ?? 'the orientation the user wants (landscape 16:9 or portrait 9:16)';

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
    'Premium building blocks (use ONLY these on-device filters so it renders everywhere):',
    `  allowlist: ${ON_DEVICE_FILTERS}`,
    '  - background: full-frame `drawbox` (t:fill) for a solid base, plus layered band drawboxes for depth.',
    '  - cinematic grade: `vignette` (+ optional `eq`) over the whole frame.',
    '  - typography: `drawtext` with a bundled font and an eased `alpha` expression over `t` for a staged',
    '    reveal, e.g. "\'if(lt(t,0.5),0,if(lt(t,1.4),(t-0.5)/0.9,1))\'".',
    '  - motion between clips: `xfade`; per-clip in/out: `fade`.',
    '  - NOT available on-device: zoompan, gradients, geq, curves — fake push-in with animated `crop`,',
    '    gradients with `color` + `vignette` or a blurred (`gblur`) scaled image.',
    `  bundled fonts (bare names, no path): ${BUNDLED_FONTS}.`,
    '',
    'Portrait is 720x1280 (9:16); landscape is 1280x720 (16:9). project_video sections need a user clip',
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
      argsSchema: argsShape,
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
