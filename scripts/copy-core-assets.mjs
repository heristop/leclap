import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const libDir = resolve(root, 'packages/ffmpeg-video-composer/src/shared/library');

// Bundle the server's template JSONs into the Expo app so the local catalog == the server catalog
// (the app compiles them on-device by default, or via the server when the user toggles it).
const serverTemplatesDir = resolve(root, 'packages/server-app/templates');

const destinations = [
  {
    src: serverTemplatesDir,
    dest: resolve(root, 'apps/le-clap-expo/src/templates/server'),
  },
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
  {
    src: resolve(libDir, 'fonts'),
    dest: resolve(root, 'apps/le-clap-web/public/fonts'),
  },
  {
    src: resolve(libDir, 'fonts'),
    dest: resolve(root, 'apps/le-clap-expo/assets/fonts'),
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
