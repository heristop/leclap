#!/usr/bin/env node
// Render the LeClap "clap" logo to a short bumper clip (src/shared/assets/videos/leclap_bumper.mp4)
// used by the premium-logo-bumper template (a `video` section that plays it, then layers the
// wordmark/fades as engine filters). Mirrors the CSS clap intro (AnimatedLogo / index.css) so the
// in-video badge matches the web splash.
//
// No npm rasterizer dep: each frame is a static SVG (the favicon clapperboard, clapper rotated to
// the per-frame angle + a scale pop), rasterized to RGBA PNG by FFmpeg's librsvg decoder; the PNG
// sequence is then composited over the brand backdrop into an H.264 clip. Re-run after changing the
// geometry/timing:  node packages/ffmpeg-video-composer/scripts/build-logo-animation.mjs
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(HERE, '../src/shared/assets/videos');
const OUT = path.join(OUT_DIR, 'leclap_bumper.mp4');
const FRAMES = 36;
const FPS = 25;
const DURATION = 2.4;
const SIZE = 512;

const easeOutBack = (x) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
};
const easeOut = (x) => 1 - (1 - x) ** 3;

// Pose at frame i: scale "pop" (0.86 → 1.06 → 1) then the clapper snapping shut (open -34° →
// overshoot past 0 → 0). The clip holds the closed badge after the snap (overlay eof freeze).
const poseAt = (i) => {
  const t = i / (FRAMES - 1);
  let scale = 1;
  if (t < 0.4) scale = 0.86 + (1.06 - 0.86) * easeOut(t / 0.4);
  else if (t < 0.6) scale = 1.06 - 0.06 * ((t - 0.4) / 0.2);
  let angle = 0;
  if (t < 0.42) angle = -34;
  else if (t < 0.66) angle = -34 + 34 * easeOutBack((t - 0.42) / 0.24);
  return { scale: Math.round(scale * 1000) / 1000, angle: Math.round(angle * 100) / 100 };
};

const svgFrame = ({
  scale,
  angle,
}) => `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="lc" x1="80" y1="64" x2="432" y2="448" gradientUnits="userSpaceOnUse">
      <stop stop-color="#7C83FD"/><stop offset="1" stop-color="#FF8AAE"/>
    </linearGradient>
  </defs>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <rect width="512" height="512" rx="116" fill="url(#lc)"/>
    <g transform="rotate(-9 256 248)">
      <rect x="124" y="172" width="264" height="200" rx="22" fill="#fff"/>
      <path d="M230 232v96l82-48z" fill="url(#lc)"/>
      <g transform="rotate(${angle} 120 150)">
        <rect x="112" y="100" width="288" height="58" rx="14" fill="#fff"/>
        <g fill="url(#lc)">
          <path d="M150 100h36l-24 58h-36z"/><path d="M214 100h36l-24 58h-36z"/>
          <path d="M278 100h36l-24 58h-36z"/><path d="M342 100h30l-24 58h-30z"/>
        </g>
      </g>
    </g>
  </g>
</svg>`;

const work = mkdtempSync(path.join(tmpdir(), 'leclap-logo-'));
try {
  for (let i = 0; i < FRAMES; i++) {
    const n = String(i + 1).padStart(3, '0');
    const svgPath = path.join(work, `f-${n}.svg`);
    const pngPath = path.join(work, `frame-${n}.png`);
    writeFileSync(svgPath, svgFrame(poseAt(i)));
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', svgPath, '-vf', 'format=rgba', pngPath]);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  // Composite the transparent clapperboard frames over the dark brand backdrop, freezing the last
  // frame to fill the clip. The template layers the wordmark + fades on top of this.
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    `color=c=#0b0b0f:s=1280x720:r=${FPS}:d=${DURATION}`,
    '-framerate',
    String(FPS),
    '-i',
    path.join(work, 'frame-%03d.png'),
    '-filter_complex',
    '[1:v]scale=360:360[logo];[0:v][logo]overlay=(W-w)/2:48:eof_action=repeat,format=yuv420p[out]',
    '-map',
    '[out]',
    '-t',
    String(DURATION),
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-an',
    OUT,
  ]);
  console.log(`Wrote bumper clip → ${OUT}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
