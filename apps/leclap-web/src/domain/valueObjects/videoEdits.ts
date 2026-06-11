// Per-clip trim/crop selected by the user before compilation. Mirrors the server contract
// (packages/server-app videoEdit.ts): trim is in seconds, crop is normalized to the source frame
// (0..1) so it is resolution-independent. The web app applies these client-side via ffmpeg.wasm
// before the in-browser compile (it does not use the server's /compile endpoint).
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { compilationLogger } from '@/lib/logger';

export interface VideoTrim {
  start: number;
  end: number;
}

export interface VideoCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface VideoEdit {
  trim?: VideoTrim;
  crop?: VideoCrop;
}

/** A crop is meaningful only when it actually shrinks the frame. */
export const isCropApplied = (crop?: VideoCrop): boolean =>
  Boolean(crop && (crop.x > 0.001 || crop.y > 0.001 || crop.w < 0.999 || crop.h < 0.999));

/** A trim is meaningful only when it removes something from the start or end. */
export const isTrimApplied = (trim: VideoTrim | undefined, duration: number): boolean =>
  Boolean(trim && (trim.start > 0.05 || (duration > 0 && trim.end < duration - 0.05)));

/** Whether an edit will change the clip at all (so we can skip the ffmpeg pass otherwise). */
export const isEditApplied = (edit?: VideoEdit, duration = 0): boolean =>
  Boolean(edit && (isCropApplied(edit.crop) || isTrimApplied(edit.trim, duration)));

// A single ffmpeg.wasm instance for the edit pass, loaded lazily and reused.
let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

async function getEditFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) {
    return ffmpegInstance;
  }

  loadPromise ??= (async () => {
    const ffmpeg = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
    const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
    await ffmpeg.load({ coreURL, wasmURL });
    ffmpegInstance = ffmpeg;

    return ffmpeg;
  })();

  return loadPromise;
}

/**
 * Build the ffmpeg args for a single clip edit. Crop is resolved against the source size via
 * ffmpeg's iw/ih, flooring width/height to even values (required by yuv420p / libx264). Trim
 * is applied as accurate output-side seeking (-ss/-to). Identical to the server's buildEditArgs.
 */
function buildEditArgs(inName: string, outName: string, edit: VideoEdit): string[] {
  const args = ['-y', '-i', inName];

  if (edit.crop && isCropApplied(edit.crop)) {
    const { x, y, w, h } = edit.crop;
    args.push('-vf', `crop=trunc(iw*${w}/2)*2:trunc(ih*${h}/2)*2:trunc(iw*${x}):trunc(ih*${y})`);
  }

  if (edit.trim && edit.trim.start > 0) {
    args.push('-ss', String(edit.trim.start));
  }

  if (edit.trim && edit.trim.end > 0) {
    args.push('-to', String(edit.trim.end));
  }

  args.push('-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', outName);

  return args;
}

export interface ApplyEditsProgress {
  index: number;
  total: number;
}

/**
 * Wrap the bytes read back from the wasm FS in a File. readFile yields a Uint8Array (or a string
 * when text-encoded); we copy into a fresh ArrayBuffer-backed view because ffmpeg.wasm may return a
 * SharedArrayBuffer view, which is not a valid BlobPart. The copy preserves the contents verbatim.
 */
function fileFromOutput(data: Uint8Array | string, index: number): File {
  const raw = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const bytes = new Uint8Array(raw.byteLength);
  bytes.set(raw);
  const blob = new Blob([bytes], { type: 'video/mp4' });

  return new File([blob], `video_${index + 1}.mp4`, { type: 'video/mp4' });
}

/**
 * Run the trim/crop pass for a single clip on the shared ffmpeg.wasm instance. The
 * writeFile -> exec -> readFile -> deleteFile sequence shares one mutable wasm FS, so the awaits
 * here are strictly ordered and this helper must be awaited one clip at a time (see applyVideoEdits).
 * On failure the original file is returned so compilation can still proceed.
 */
async function editClip(ffmpeg: FFmpeg, file: File, edit: VideoEdit, index: number): Promise<File> {
  const ext = file.name.split('.').pop() ?? 'mp4';
  const inName = `edit_in_${index}.${ext}`;
  const outName = `edit_out_${index}.mp4`;

  try {
    await ffmpeg.writeFile(inName, await fetchFile(file));
    await ffmpeg.exec(buildEditArgs(inName, outName, edit));
    const data = await ffmpeg.readFile(outName);

    return fileFromOutput(data, index);
  } catch (error) {
    // If a single clip's edit fails, fall back to the original so compilation still proceeds.
    compilationLogger.warn(`Video edit failed for clip ${index + 1}, using original:`, error);

    return file;
  } finally {
    await ffmpeg.deleteFile(inName).catch(() => {});
    await ffmpeg.deleteFile(outName).catch(() => {});
  }
}

/**
 * Apply per-clip trim/crop to the uploaded files, returning a new File[] with the edited clips
 * (clips without a meaningful edit pass through untouched). Runs entirely in the browser via
 * ffmpeg.wasm, so the result feeds straight into the existing in-browser compile.
 */
export async function applyVideoEdits(
  files: File[],
  edits: Record<number, VideoEdit | undefined>,
  onProgress?: (progress: ApplyEditsProgress) => void
): Promise<File[]> {
  const toEdit = files.some((_, i) => isEditApplied(edits[i]));

  if (!toEdit) {
    return files;
  }

  const ffmpeg = await getEditFFmpeg();
  const result: File[] = [];

  // Sequential by necessity: a single ffmpeg.wasm instance can only run one exec at a time and the
  // clips share one wasm FS, so these passes cannot be parallelized. no-await-in-loop is overridden
  // for this file in vite.config.ts for that reason.
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const edit = edits[i];

    if (!edit || !isEditApplied(edit)) {
      result.push(file);
      continue;
    }

    onProgress?.({ index: i, total: files.length });
    result.push(await editClip(ffmpeg, file, edit, i));
  }

  return result;
}
