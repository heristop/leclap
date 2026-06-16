import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { basename, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const libDir = resolve(root, 'packages/leclap-creative-kit/src/library');

// Plain ANSI, no dependency — and dropped entirely when the output isn't a TTY (CI logs, pipes).
const color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: number, text: string): string => (color ? `[${code}m${text}[0m` : text);
const bold = (text: string): string => paint(1, text);
const dim = (text: string): string => paint(2, text);
const green = (text: string): string => paint(32, text);

type CopyDest = { src: string; dest: string; include?: string[] };

const destinations: CopyDest[] = [
  {
    src: resolve(libDir, 'musics'),
    dest: resolve(root, 'apps/leclap-web/public/musics'),
  },
  {
    src: resolve(libDir, 'musics'),
    dest: resolve(root, 'apps/leclap-expo/assets/musics'),
  },
  {
    src: resolve(libDir, 'backgrounds'),
    dest: resolve(root, 'apps/leclap-web/public/backgrounds'),
  },
  {
    src: resolve(libDir, 'backgrounds'),
    dest: resolve(root, 'apps/leclap-expo/assets/backgrounds'),
  },
  {
    src: resolve(libDir, 'fonts'),
    dest: resolve(root, 'apps/leclap-web/public/fonts'),
  },
  {
    src: resolve(libDir, 'fonts'),
    dest: resolve(root, 'apps/leclap-expo/assets/fonts'),
  },
  {
    src: resolve(libDir, 'animations'),
    dest: resolve(root, 'apps/leclap-web/public/assets/animations'),
  },
  {
    src: resolve(libDir, 'musics'),
    dest: resolve(root, 'apps/leclap-web/public/assets/musics'),
  },
  {
    src: resolve(libDir, 'pictures'),
    dest: resolve(root, 'apps/leclap-web/public/assets/pictures'),
  },
  {
    src: resolve(libDir, 'videos'),
    dest: resolve(root, 'apps/leclap-web/public/assets/videos'),
  },
  {
    // The RN app only needs the brand bumpers bundled (the descriptor-referenced videos); the rest
    // are sample clips that would bloat the binary. Web ships the full set above.
    src: resolve(libDir, 'videos'),
    dest: resolve(root, 'apps/leclap-expo/assets/videos'),
    include: ['leclap_bumper.mp4', 'leclap_bumper_portrait.mp4'],
  },
];

console.log(`\n${bold('Staging creative-kit assets')}`);

let total = 0;

for (const { src, dest, include } of destinations) {
  mkdirSync(dest, { recursive: true });
  const files = include ?? readdirSync(src);

  for (const file of files) {
    cpSync(resolve(src, file), resolve(dest, file));
  }

  total += files.length;

  const count = String(files.length).padStart(3);
  console.log(`  ${green('✓')} ${basename(src).padEnd(11)} ${dim(count)} ${dim('→')} ${dim(relative(root, dest))}`);
}

console.log(`\n${green('✓')} ${bold(`${total} files`)} staged across ${destinations.length} targets\n`);
