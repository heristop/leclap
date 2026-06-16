import { defineCommand } from 'citty';
import fs from 'node:fs/promises';
import path from 'node:path';
import pc from 'picocolors';
import { success, fail, step, hint } from '../ui.js';
import { confirm } from '../prompt.js';

const REMOTION_VERSION = '^4.0.477';

export interface StarterOptions {
  /** Add a `.mcp.json` wiring `@leclap/mcp` so an agent can author + render in this project. */
  mcp?: boolean;
  /** Add a Remotion starter project (`remotion/`) for animated intros, rendered via the MCP. */
  remotion?: boolean;
  /** Absolute project dir — baked into `.mcp.json` env paths. Defaults to the project name. */
  projectDir?: string;
}

// A title card that renders with no external media — `BebasNeue.ttf` resolves from the engine's
// bundled fonts. `withIntro` prepends a project_video "intro" slot for a rendered Remotion clip.
function starterTemplate(withIntro: boolean) {
  const titleCard = {
    name: 'title',
    type: 'color_background',
    options: { backgroundColor: '#0d1b2a', duration: 3 },
    filters: [
      {
        type: 'drawtext',
        values: {
          text: { en: 'Hello, LeClap' },
          fontcolor: '#ffffff',
          fontsize: 96,
          x: '(w-text_w)/2',
          y: '(h-text_h)/2',
          fontfile: 'BebasNeue.ttf',
        },
      },
    ],
  };

  if (!withIntro) {
    return { global: { orientation: 'landscape', musicEnabled: false }, sections: [titleCard] };
  }

  // The Remotion intro is supplied at compose time via userVideoPaths.intro.
  const intro = {
    name: 'intro',
    type: 'project_video',
    options: { duration: 3 },
    transition: { type: 'fade', duration: 0.5 },
  };

  return { global: { orientation: 'landscape', musicEnabled: false }, sections: [intro, titleCard] };
}

function packageJson(projectName: string, opts: StarterOptions) {
  const devDependencies: Record<string, string> = { '@leclap/cli': '^0.1.0' };

  // The MCP is a local devDep only when Remotion is set up — render_remotion_clip dynamically imports
  // @remotion/* (the MCP's optional peer deps), which resolve only from the local install. Without
  // Remotion the MCP runs zero-install via `npx -y` (see mcpConfig), so it needs no entry here.
  if (opts.mcp && opts.remotion) {
    devDependencies['@leclap/mcp'] = '^0.1.0';
  }

  if (opts.remotion) {
    devDependencies['@remotion/bundler'] = REMOTION_VERSION;
    devDependencies['@remotion/renderer'] = REMOTION_VERSION;
    devDependencies.remotion = REMOTION_VERSION;
    devDependencies.react = '^19.0.0';
    devDependencies['react-dom'] = '^19.0.0';
  }

  return {
    name: projectName,
    private: true,
    type: 'module',
    scripts: { render: 'leclap render template.json' },
    devDependencies,
  };
}

// The project-scoped MCP server config (Claude Code / generic `.mcp.json` shape). Absolute env paths so
// it resolves regardless of the client's working directory.
function mcpConfig(projectDir: string, remotion: boolean) {
  const env: Record<string, string> = {
    LECLAP_MCP_MEDIA_DIR: projectDir,
    LECLAP_MCP_OUTPUT_DIR: path.join(projectDir, 'build'),
  };

  if (remotion) {
    env.LECLAP_MCP_REMOTION_ENTRY = path.join(projectDir, 'remotion', 'index.ts');
  }

  // With Remotion the MCP is a local devDep (so it resolves the project's @remotion) — run the local
  // install. Without Remotion it has no local install, so fetch it zero-install via `npx -y`.
  const args = remotion ? ['@leclap/mcp'] : ['-y', '@leclap/mcp'];

  return { mcpServers: { leclap: { command: 'npx', args, env } } };
}

// A self-contained Remotion starter (system font, no asset deps): a spring-popped wordmark, a drawn
// accent bar, and a fading tagline. The MCP renders composition "Intro" to a clip via render_remotion_clip.
function remotionFiles(projectName: string): Record<string, string> {
  // A single-quoted TS string literal, to match the generated files' quote style.
  const wm = `'${projectName.replace(/\\/g, String.raw`\\`).replace(/'/g, String.raw`\'`)}'`;
  const intro = `import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

const BG = '#0d1b2a';
const ACCENT = '#5eead4';

interface IntroProps {
  wordmark?: string;
  tagline?: string;
}

export const Intro = ({ wordmark = ${wm}, tagline = 'MADE WITH LECLAP' }: IntroProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, durationInFrames: 24, config: { damping: 13, stiffness: 150, mass: 0.7 } });
  const scale = interpolate(pop, [0, 1], [0.82, 1]);
  const barW = interpolate(
    spring({ frame: frame - 12, fps, durationInFrames: 20, config: { damping: 18 } }),
    [0, 1],
    [0, 320]
  );
  const tag = spring({ frame: frame - 24, fps, durationInFrames: 18, config: { damping: 16 } });

  return (
    <AbsoluteFill
      style={{ backgroundColor: BG, justifyContent: 'center', alignItems: 'center', fontFamily: 'Helvetica, Arial, sans-serif' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, transform: \`scale(\${scale})\` }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 128, letterSpacing: -2, lineHeight: 1 }}>{wordmark}</div>
        <div style={{ width: barW, height: 10, background: ACCENT, borderRadius: 5 }} />
        <div style={{ opacity: tag, color: ACCENT, fontWeight: 600, fontSize: 26, letterSpacing: 6 }}>{tagline}</div>
      </div>
    </AbsoluteFill>
  );
};
`;

  const root = `import { Composition } from 'remotion';
import { Intro } from './Intro';

export const RemotionRoot = () => (
  <Composition
    id="Intro"
    component={Intro}
    durationInFrames={90}
    fps={30}
    width={1280}
    height={720}
    defaultProps={{ wordmark: ${wm}, tagline: 'MADE WITH LECLAP' }}
  />
);
`;

  const index = `import { registerRoot } from 'remotion';
import { RemotionRoot } from './Root';

registerRoot(RemotionRoot);
`;

  return {
    'remotion/Intro.tsx': intro,
    'remotion/Root.tsx': root,
    'remotion/index.ts': index,
  };
}

function readme(projectName: string, opts: StarterOptions): string {
  const mcpSection = opts.mcp
    ? `

## Author with an AI agent (MCP)

This project ships an \`.mcp.json\` wiring [\`@leclap/mcp\`](https://github.com/heristop/leclap).
Point your agent client (Claude Code, Cursor, …) at it, then ask the agent to author and \`compose_video\`.${
        opts.remotion
          ? ` For an animated intro, the agent calls \`render_remotion_clip { compositionId: "Intro" }\`
(rendered from \`remotion/\`) and passes the clip to \`compose_video\` via \`userVideoPaths.intro\`.

Run \`npm install\` first: with Remotion the MCP runs from the **local** install so it can resolve your
\`@remotion/*\` and render \`remotion/\`.`
          : ` The MCP runs zero-install via \`npx\` — no \`npm install\` needed for it.`
      }

> The \`.mcp.json\` env paths are absolute (this machine). Regenerate or edit them if you move the project.`
    : '';

  const remotionSection = opts.remotion
    ? `

## Remotion intro

\`remotion/\` is a standalone [Remotion](https://www.remotion.dev) project (composition \`Intro\`).
Install deps, then the MCP renders it to a clip that \`template.json\`'s \`intro\` section composites.`
    : '';

  return `# ${projectName}

A LeClap video project. Edit \`template.json\`, drop any media into \`assets/\`, then render:

\`\`\`bash
npm install
npx @leclap/cli render template.json
\`\`\`
${mcpSection}${remotionSection}

See the descriptor reference: https://github.com/heristop/leclap
`;
}

// Pure: the file set for a new project, keyed by project-relative path. No IO.
export function starterFiles(projectName: string, opts: StarterOptions = {}): Record<string, string> {
  const projectDir = opts.projectDir ?? projectName;

  const files: Record<string, string> = {
    'template.json': `${JSON.stringify(starterTemplate(Boolean(opts.remotion)), null, 2)}\n`,
    'package.json': `${JSON.stringify(packageJson(projectName, opts), null, 2)}\n`,
    'README.md': readme(projectName, opts),
    'assets/.gitkeep': '',
  };

  if (opts.mcp) {
    files['.mcp.json'] = `${JSON.stringify(mcpConfig(projectDir, Boolean(opts.remotion)), null, 2)}\n`;
  }

  if (opts.remotion) {
    Object.assign(files, remotionFiles(projectName));
  }

  return files;
}

// Resolve a yes/no setup choice: an explicit flag wins; `--yes` (or a non-TTY context) takes the
// default; otherwise prompt (default Yes).
async function resolveChoice(flag: boolean | undefined, yes: boolean | undefined, message: string): Promise<boolean> {
  if (flag !== undefined) {
    return flag;
  }

  if (yes) {
    return true;
  }

  return confirm(message, true);
}

export const init = defineCommand({
  meta: { name: 'init', description: 'Scaffold a starter LeClap project' },
  args: {
    name: {
      type: 'positional',
      description: 'Project directory to create',
      required: false,
      default: 'my-leclap-video',
    },
    mcp: { type: 'boolean', description: 'Add @leclap/mcp wiring (.mcp.json) — prompts by default' },
    remotion: { type: 'boolean', description: 'Add a Remotion starter for animated intros — prompts by default' },
    yes: { type: 'boolean', alias: 'y', description: 'Accept all defaults (no prompts)' },
  },
  async run({ args }) {
    const name = args.name || 'my-leclap-video';
    const dir = path.resolve(process.cwd(), name);

    try {
      const entries = await fs.readdir(dir);

      if (entries.length > 0) {
        console.error(fail(`${pc.bold(name)} already exists and is not empty`));
        process.exit(1);
      }
    } catch {
      // Directory doesn't exist yet — that's the happy path.
    }

    const mcp = await resolveChoice(args.mcp, args.yes, 'Set up the LeClap MCP server for AI-agent authoring?');
    const remotion = await resolveChoice(args.remotion, args.yes, 'Add a Remotion starter for animated intros?');

    const files = starterFiles(path.basename(dir), { mcp, remotion, projectDir: dir });

    await Promise.all(
      Object.entries(files).map(async ([relative, contents]) => {
        const target = path.join(dir, relative);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, contents);
      })
    );

    console.log(`\n${success(`Created ${pc.cyan(name)}`)}\n`);
    console.log(hint('Next steps'));
    console.log(step(`cd ${name}`));
    console.log(step('npm install'));
    console.log(step('leclap render template.json'));

    if (mcp) {
      console.log(step('point your agent client at .mcp.json, then ask it to compose a video'));
    }

    console.log('');
  },
});
