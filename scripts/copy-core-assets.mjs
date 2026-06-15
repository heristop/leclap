import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const libDir = resolve(root, 'packages/creative-kit/src/library');
const assetsDir = resolve(root, 'packages/creative-kit/src/assets');

// Bundle the server's template JSONs into the Expo app so the local catalog == the server catalog
// (the app compiles them on-device by default, or via the server when the user toggles it).
const serverTemplatesDir = resolve(root, 'packages/server-app/templates');

const destinations = [
  {
    src: serverTemplatesDir,
    dest: resolve(root, 'apps/leclap-expo/src/templates/server'),
  },
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
    src: resolve(assetsDir, 'animations'),
    dest: resolve(root, 'apps/leclap-web/public/assets/animations'),
  },
  {
    src: resolve(assetsDir, 'musics'),
    dest: resolve(root, 'apps/leclap-web/public/assets/musics'),
  },
  {
    src: resolve(assetsDir, 'pictures'),
    dest: resolve(root, 'apps/leclap-web/public/assets/pictures'),
  },
  {
    src: resolve(assetsDir, 'videos'),
    dest: resolve(root, 'apps/leclap-web/public/assets/videos'),
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
