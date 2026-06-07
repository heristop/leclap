import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const libDir = resolve(root, 'packages/core/src/shared/library');

const destinations = [
  {
    src: resolve(libDir, 'musics'),
    dest: resolve(root, 'apps/le-clap-web/public/musics'),
  },
  {
    src: resolve(libDir, 'musics'),
    dest: resolve(root, 'apps/le-clap-expo/assets/musics'),
  },
  {
    src: resolve(libDir, 'backgrounds'),
    dest: resolve(root, 'apps/le-clap-web/public/backgrounds'),
  },
  {
    src: resolve(libDir, 'backgrounds'),
    dest: resolve(root, 'apps/le-clap-expo/assets/backgrounds'),
  },
];

for (const { src, dest } of destinations) {
  mkdirSync(dest, { recursive: true });
  const files = readdirSync(src);
  let count = 0;

  for (const file of files) {
    cpSync(resolve(src, file), resolve(dest, file));
    count++;
  }

  console.log(`Copied ${count} files: ${src} -> ${dest}`);
}
