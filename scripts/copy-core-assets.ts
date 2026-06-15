import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const libDir = resolve(root, 'packages/creative-kit/src/library');

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
    // The RN app only needs the brand bumper bundled (the sole descriptor-referenced video); the rest
    // are sample clips that would bloat the binary. Web ships the full set above.
    src: resolve(libDir, 'videos'),
    dest: resolve(root, 'apps/leclap-expo/assets/videos'),
    include: ['leclap_bumper.mp4'],
  },
];

for (const { src, dest, include } of destinations) {
  mkdirSync(dest, { recursive: true });
  const files = include ?? readdirSync(src);
  let count = 0;

  for (const file of files) {
    cpSync(resolve(src, file), resolve(dest, file));
    count++;
  }

  console.log(`Copied ${count} files: ${src} -> ${dest}`);
}
