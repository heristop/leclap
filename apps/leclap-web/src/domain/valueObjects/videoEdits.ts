// Per-clip trim/crop selected by the user before compilation. Trim is in seconds, crop is
// normalized to the source frame (0..1) so it is resolution-independent. The web app applies these
// client-side via ffmpeg.wasm before the in-browser compile.
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

// One slice of the source clip on the timeline: a [start, end] range (source seconds) played at `speed`
// (1 = normal, <1 slow, >1 fast). Splitting inserts a boundary; deleting removes a slice; the ordered
// list IS the edited clip. A single untouched slice [0, duration] @1× means "no timeline edit".
export interface ClipSegment {
  id: string;
  start: number;
  end: number;
  speed: number;
}

export interface VideoEdit {
  // Legacy single trim window — still read for migration; the timeline editor writes `segments` instead.
  trim?: VideoTrim;
  crop?: VideoCrop;
  segments?: ClipSegment[];
}

/** A crop is meaningful only when it actually shrinks the frame. */
export const isCropApplied = (crop?: VideoCrop): boolean =>
  Boolean(crop && (crop.x > 0.001 || crop.y > 0.001 || crop.w < 0.999 || crop.h < 0.999));

/** A trim is meaningful only when it removes something from the start or end. */
export const isTrimApplied = (trim: VideoTrim | undefined, duration: number): boolean =>
  Boolean(trim && (trim.start > 0.05 || (duration > 0 && trim.end < duration - 0.05)));

// The canonical timeline for a clip: explicit segments win, else a legacy trim becomes one segment, else
// the whole clip at 1×. Keeps projects saved before the timeline editor working unchanged.
export const resolveSegments = (edit: VideoEdit | undefined, duration: number): ClipSegment[] => {
  if (edit?.segments && edit.segments.length > 0) return edit.segments;

  if (edit?.trim && (edit.trim.start > 0 || edit.trim.end > 0)) {
    return [{ id: 'seg-0', start: edit.trim.start, end: edit.trim.end > 0 ? edit.trim.end : duration, speed: 1 }];
  }

  return [{ id: 'seg-0', start: 0, end: duration, speed: 1 }];
};

// A timeline changes the clip when it has more than one segment, any non-1× speed, or trimmed outer edges.
export const isTimelineApplied = (segments: ClipSegment[], duration: number): boolean => {
  if (segments.length === 0) return false;

  if (segments.length > 1) return true;

  if (segments.some((s) => Math.abs(s.speed - 1) > 0.001)) return true;

  const first = segments[0];

  return first.start > 0.05 || (duration > 0 && first.end < duration - 0.05);
};

/** Whether an edit will change the clip at all (so we can skip the ffmpeg pass otherwise). */
export const isEditApplied = (edit?: VideoEdit, duration = 0): boolean =>
  Boolean(edit && (isCropApplied(edit.crop) || isTrimApplied(edit.trim, duration) || (edit.segments?.length ?? 0) > 0));

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

// The `crop=…,` prefix shared by the single-pass and timeline graphs (empty when no crop). Width/height
// are floored to even values (yuv420p / libx264 requirement); offsets stay normalized against iw/ih.
const cropPrefix = (crop?: VideoCrop): string => {
  if (!crop || !isCropApplied(crop)) return '';

  return `crop=trunc(iw*${crop.w}/2)*2:trunc(ih*${crop.h}/2)*2:trunc(iw*${crop.x}):trunc(ih*${crop.y}),`;
};

/**
 * Build the `-filter_complex` that renders a multi-segment timeline into one clip: each kept segment is
 * trimmed (`trim`/`atrim`), re-timed for its speed (`setpts`/`atempo`), then the segments are joined with
 * `concat`. `setpts=(PTS-STARTPTS)/speed` resets each slice's timestamps (required by concat) and divides
 * them by the speed (2× → half the duration). When the source has no audio track, the audio chains are
 * dropped and concat runs video-only so it never references a missing `0:a`.
 */
export function buildTimelineArgs(
  inName: string,
  outName: string,
  segments: ClipSegment[],
  crop: VideoCrop | undefined,
  hasAudio: boolean
): string[] {
  const cropPre = cropPrefix(crop);
  const chains: string[] = [];
  const concatInputs: string[] = [];

  for (const [k, s] of segments.entries()) {
    chains.push(`[0:v]${cropPre}trim=start=${s.start}:end=${s.end},setpts=(PTS-STARTPTS)/${s.speed}[v${k}]`);
    concatInputs.push(`[v${k}]`);

    if (hasAudio) {
      chains.push(`[0:a]atrim=start=${s.start}:end=${s.end},asetpts=PTS-STARTPTS,atempo=${s.speed}[a${k}]`);
      concatInputs.push(`[a${k}]`);
    }
  }

  const aFlag = hasAudio ? 1 : 0;
  const outLabels = hasAudio ? '[v][a]' : '[v]';
  chains.push(`${concatInputs.join('')}concat=n=${segments.length}:v=1:a=${aFlag}${outLabels}`);

  const args = ['-y', '-i', inName, '-filter_complex', chains.join(';'), '-map', '[v]'];

  if (hasAudio) args.push('-map', '[a]');

  args.push('-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p');

  if (hasAudio) args.push('-c:a', 'aac');

  args.push(outName);

  return args;
}

// ffmpeg.wasm has no ffprobe, so probe by running `-i` with no output: ffmpeg prints the stream dump to
// the log (then errors because no output file is given). A `Stream … Audio:` line means an audio track.
async function hasAudioStream(ffmpeg: FFmpeg, inName: string): Promise<boolean> {
  let log = '';
  const onLog = (event: { message: string }): void => {
    log += `${event.message}\n`;
  };

  ffmpeg.on('log', onLog);

  try {
    await ffmpeg.exec(['-hide_banner', '-i', inName]);
  } catch {
    // Expected: no output file → non-zero exit. The stream info we need is already in the captured log.
  } finally {
    ffmpeg.off('log', onLog);
  }

  return /Stream #\d+:\d+.*: Audio:/.test(log);
}

// Pick the cheapest pass for a clip's edit: no segments (or one untouched-speed segment) uses the fast
// -ss/-to path; a real timeline (a split or a speed change) uses the concat filter graph.
async function buildClipArgs(ffmpeg: FFmpeg, inName: string, outName: string, edit: VideoEdit): Promise<string[]> {
  const segments = edit.segments;

  if (!segments || segments.length === 0) {
    return buildEditArgs(inName, outName, edit);
  }

  const single = segments.length === 1 && Math.abs(segments[0].speed - 1) < 0.001 ? segments[0] : null;

  if (single) {
    return buildEditArgs(inName, outName, { crop: edit.crop, trim: { start: single.start, end: single.end } });
  }

  const hasAudio = await hasAudioStream(ffmpeg, inName);

  return buildTimelineArgs(inName, outName, segments, edit.crop, hasAudio);
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
    await ffmpeg.exec(await buildClipArgs(ffmpeg, inName, outName, edit));
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
  edits: Record<string, VideoEdit | undefined>,
  sectionNames: string[],
  onProgress?: (progress: ApplyEditsProgress) => void
): Promise<File[]> {
  const editFor = (i: number): VideoEdit | undefined => edits[sectionNames[i]];
  const toEdit = files.some((_, i) => isEditApplied(editFor(i)));

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
    const edit = editFor(i);

    if (!edit || !isEditApplied(edit)) {
      result.push(file);
      continue;
    }

    onProgress?.({ index: i, total: files.length });
    result.push(await editClip(ffmpeg, file, edit, i));
  }

  return result;
}
