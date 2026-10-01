import { mkdir, copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const font = process.argv[2];

if (!font) throw new Error('Pass a local .ttf font file: node generate-media.mjs /absolute/path/font.ttf');
await mkdir(path.join(directory, 'media'), { recursive: true });
function ffmpeg(args) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });

  if (result.error) throw result.error;

  if (result.status !== 0) throw new Error(`Fixture FFmpeg exited ${result.status}`);
}
ffmpeg([
  '-f',
  'lavfi',
  '-i',
  'color=c=0x101022:s=1280x720:r=30:d=10',
  '-c:v',
  'libx264',
  '-preset',
  'ultrafast',
  '-pix_fmt',
  'yuv420p',
  path.join(directory, 'media/background.mp4'),
]);
ffmpeg([
  '-f',
  'lavfi',
  '-i',
  'color=c=0x7c83ff:s=256x256',
  '-frames:v',
  '1',
  '-threads',
  '1',
  path.join(directory, 'media/logo.png'),
]);
await copyFile(path.resolve(font), path.join(directory, 'media/font.ttf'));
