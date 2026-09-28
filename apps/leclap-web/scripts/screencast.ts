// High-quality screen capture for the Remotion promo clips. Chrome's own screencast (CDP
// Page.startScreencast) delivers each painted frame at 2x device pixels as a JPEG; ffmpeg lays them out on
// their real timestamps and writes a constant-rate, supersampled H.264. Playwright's recordVideo writes a
// low-bitrate VP8 webm whose UI text smears once the clip is scaled into a film frame.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { Browser, Page } from '@playwright/test';

export interface CastSize {
  width: number;
  height: number;
}

export interface CastOpts {
  /** Drop the first N seconds (page load, setup). */
  startSeconds?: number;
  /** Keep only the last N seconds. */
  tailSeconds?: number;
}

interface Frame {
  data: string;
  /** Wall-clock arrival, seconds — one clock for every frame and for the end of the take. */
  at: number;
}

// Frames are captured at 2x device pixels and delivered at 1.5x: supersampled, crisp once scaled down.
const DPR = 2;
const OUT_SCALE = 1.5;
const FPS = 30;

const seekArgs = (opts: CastOpts): string[] => {
  if (opts.tailSeconds) return ['-sseof', `-${opts.tailSeconds}`];

  if (opts.startSeconds) return ['-ss', `${opts.startSeconds}`];

  return [];
};

/** An ffconcat list holding each frame for as long as it stayed on screen. */
const concatList = (frames: readonly Frame[], files: readonly string[], end: number): string => {
  const entries = frames.map((frame, index) => {
    const next = frames[index + 1]?.at ?? end;

    return `file '${files[index]}'\nduration ${Math.max(1 / FPS, next - frame.at).toFixed(4)}`;
  });

  // The concat demuxer ignores the last entry's duration unless the file is listed once more.
  return ['ffconcat version 1.0', ...entries, `file '${files.at(-1)}'`].join('\n');
};

/** Run `scenario` in a fresh 2x context while Chrome screencasts it, then write `dest` (mp4). */
export const recordScreencast = async (
  browser: Browser,
  size: CastSize,
  scenario: (page: Page) => Promise<void>,
  dest: string,
  opts: CastOpts = {}
): Promise<void> => {
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: DPR });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const frames: Frame[] = [];

  cdp.on('Page.screencastFrame', (event) => {
    frames.push({ data: event.data, at: Date.now() / 1000 });
    cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 92,
    maxWidth: size.width * DPR,
    maxHeight: size.height * DPR,
    everyNthFrame: 1,
  });
  await scenario(page).catch((error: unknown) => {
    process.stderr.write(
      `[${path.basename(dest)}] scenario failed: ${error instanceof Error ? error.message : String(error)}\n`
    );
  });
  await cdp.send('Page.stopScreencast');
  const end = Date.now() / 1000;
  await context.close();

  if (frames.length === 0) throw new Error(`${dest}: the screencast delivered no frames`);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'leclap-cast-'));
  const files = frames.map((frame, index) => {
    const file = path.join(dir, `f${String(index).padStart(5, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(frame.data, 'base64'));

    return file;
  });
  const list = path.join(dir, 'frames.ffconcat');
  fs.writeFileSync(list, concatList(frames, files, end));

  execFileSync(
    'ffmpeg',
    [
      '-y',
      ...seekArgs(opts),
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      list,
      '-an',
      '-vf',
      `fps=${FPS},scale=${Math.round(size.width * OUT_SCALE)}:-2:flags=lanczos,format=yuv420p,setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709`,
      '-c:v',
      'libx264',
      '-crf',
      '15',
      '-preset',
      'slow',
      '-movflags',
      '+faststart',
      dest,
    ],
    { stdio: 'ignore' }
  );
  fs.rmSync(dir, { recursive: true, force: true });
  process.stdout.write(`rendered ${path.basename(dest)} (${frames.length} frames)\n`);
};
