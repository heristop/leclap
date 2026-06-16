import { defineCommand } from 'citty';
import fs from 'node:fs/promises';
import path from 'node:path';
import pc from 'picocolors';

// The starter template: a graded title card. It renders with no external media — the `BebasNeue.ttf`
// font resolves from the engine's bundled fonts.
const STARTER_TEMPLATE = {
  global: { orientation: 'landscape', musicEnabled: false },
  sections: [
    {
      name: 'intro',
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
    },
  ],
};

// Pure: the file set for a new project, keyed by project-relative path. No IO.
export function starterFiles(projectName: string): Record<string, string> {
  const pkg = {
    name: projectName,
    private: true,
    type: 'module',
    scripts: { render: 'leclap render template.json' },
    devDependencies: { '@leclap/cli': '^0.1.0' },
  };

  const readme = `# ${projectName}

A LeClap video project. Edit \`template.json\`, drop any media into \`assets/\`, then render:

\`\`\`bash
npx @leclap/cli render template.json
\`\`\`

See the descriptor reference: https://github.com/heristop/ffmpeg-video-composer
`;

  return {
    'template.json': `${JSON.stringify(STARTER_TEMPLATE, null, 2)}\n`,
    'package.json': `${JSON.stringify(pkg, null, 2)}\n`,
    'README.md': readme,
    'assets/.gitkeep': '',
  };
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
  },
  async run({ args }) {
    const name = args.name || 'my-leclap-video';
    const dir = path.resolve(process.cwd(), name);

    try {
      const entries = await fs.readdir(dir);

      if (entries.length > 0) {
        console.error(`${pc.red('Error:')} ${pc.bold(name)} already exists and is not empty`);
        process.exit(1);
      }
    } catch {
      // Directory doesn't exist yet — that's the happy path.
    }

    const files = starterFiles(path.basename(dir));

    await Promise.all(
      Object.entries(files).map(async ([relative, contents]) => {
        const target = path.join(dir, relative);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, contents);
      })
    );

    console.log(`\n${pc.green('✅')} ${pc.bold('Created')} ${pc.cyan(name)}\n`);
    console.log(pc.dim('Next steps:'));
    console.log(`  ${pc.green('cd')} ${name}`);
    console.log(`  ${pc.green('npx @leclap/cli render')} ${pc.yellow('template.json')}\n`);
  },
});
