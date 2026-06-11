import path from 'path';
import { spawn } from 'child_process';

// Per-section trim/crop selected by the user on the device. Times are in seconds;
// crop is normalized to the source frame (0..1), so it is resolution-independent.
export interface VideoEdit {
  trimStart?: number;
  trimEnd?: number;
  crop?: { x: number; y: number; w: number; h: number };
}

// Minimal logger surface so this module stays decoupled from Fastify.
export interface EditLogger {
  info(message: string): void;
  error(message: string): void;
}

// Thrown when a client-supplied video edit fails validation (-> HTTP 400).
export class VideoEditValidationError extends Error {}

/**
 * Run ffmpeg with the given args (ffmpeg must be on PATH). Resolves on exit code 0.
 */
export function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args);
    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();

        return;
      }

      reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-400)}`));
    });
  });
}

/**
 * Coerce an untrusted value to a finite, non-negative number, or null if it isn't one.
 * Rejects NaN/Infinity/negative/non-numeric so nothing malformed (or a leading "-" that
 * ffmpeg would read as a flag) can reach the argument list.
 */
function finiteNonNegative(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

interface ValidatedTrim {
  trimStart: number | null;
  trimEnd: number | null;
}

// Validate trim. trimStart/trimEnd are optional; when present they must be finite & >= 0.
function validateTrim(edit: VideoEdit): ValidatedTrim {
  const trimStart = edit.trimStart === undefined ? null : finiteNonNegative(edit.trimStart);
  const trimEnd = edit.trimEnd === undefined ? null : finiteNonNegative(edit.trimEnd);

  if (edit.trimStart !== undefined && trimStart === null) {
    throw new VideoEditValidationError('Invalid trimStart: must be a finite, non-negative number');
  }

  if (edit.trimEnd !== undefined && trimEnd === null) {
    throw new VideoEditValidationError('Invalid trimEnd: must be a finite, non-negative number');
  }

  return { trimStart, trimEnd };
}

// Validate crop. Values are normalized fractions of the source frame (0..1); all four
// fields are required, w/h must be positive, and the region must stay inside the frame.
function validateCrop(edit: VideoEdit): { x: number; y: number; w: number; h: number } | null {
  if (edit.crop === undefined) {
    return null;
  }

  const x = finiteNonNegative(edit.crop.x);
  const y = finiteNonNegative(edit.crop.y);
  const w = finiteNonNegative(edit.crop.w);
  const h = finiteNonNegative(edit.crop.h);
  const EPS = 0.001;

  if (
    x === null ||
    y === null ||
    w === null ||
    h === null ||
    w <= 0 ||
    h <= 0 ||
    x > 1 ||
    y > 1 ||
    w > 1 ||
    h > 1 ||
    x + w > 1 + EPS ||
    y + h > 1 + EPS
  ) {
    throw new VideoEditValidationError(
      'Invalid crop: x/y/w/h must be fractions in [0,1] with w,h > 0 and the region inside the frame'
    );
  }

  return { x, y, w, h };
}

function buildEditArgs(
  inputPath: string,
  outputPath: string,
  trim: ValidatedTrim,
  crop: { x: number; y: number; w: number; h: number } | null
): string[] {
  const args = ['-y', '-i', inputPath];

  if (crop) {
    // Crop is normalized; resolve against the source size via ffmpeg's iw/ih, flooring
    // width/height to even values (required by yuv420p / libx264).
    args.push('-vf', `crop=trunc(iw*${crop.w}/2)*2:trunc(ih*${crop.h}/2)*2:trunc(iw*${crop.x}):trunc(ih*${crop.y})`);
  }

  if (trim.trimStart !== null && trim.trimStart > 0) {
    args.push('-ss', String(trim.trimStart));
  }

  if (trim.trimEnd !== null && trim.trimEnd > 0) {
    args.push('-to', String(trim.trimEnd));
  }

  args.push('-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', outputPath);

  return args;
}

// A noop plan keeps the original clip; a run plan records the ffmpeg invocation to perform.
type EditPlan = { kind: 'noop'; path: string } | { kind: 'run'; outputPath: string; args: string[] };

/**
 * Validate the user's trim/crop and compute what needs to happen, without running ffmpeg.
 * Returns a noop plan (use the original path) when there is nothing to do. Throws on
 * malformed (non-finite/negative) crop or trim values. Validation is fully synchronous so
 * callers can reject a malformed request before any ffmpeg side effects occur.
 */
function planVideoEdit(inputPath: string, edit: VideoEdit | undefined): EditPlan {
  if (!edit) {
    return { kind: 'noop', path: inputPath };
  }

  const trim = validateTrim(edit);
  const crop = validateCrop(edit);

  const hasTrim = (trim.trimStart !== null && trim.trimStart > 0) || (trim.trimEnd !== null && trim.trimEnd > 0);
  const hasCrop = crop !== null;

  if (!hasTrim && !hasCrop) {
    return { kind: 'noop', path: inputPath };
  }

  const dir = path.dirname(inputPath);
  const base = path.basename(inputPath, path.extname(inputPath));
  const outputPath = path.join(dir, `${base}-edited.mp4`);

  return { kind: 'run', outputPath, args: buildEditArgs(inputPath, outputPath, trim, crop) };
}

/**
 * Apply the user's trim/crop to a recorded clip and return the path to use for compilation.
 * Trim/crop are applied as output options (accurate seeking); returns the original path when
 * there is nothing to do. Throws on malformed (non-finite/negative) crop or trim values.
 */
export async function applyVideoEdit(inputPath: string, edit: VideoEdit | undefined): Promise<string> {
  const plan = planVideoEdit(inputPath, edit);

  if (plan.kind === 'noop') {
    return plan.path;
  }

  await runFfmpeg(plan.args);

  return plan.outputPath;
}

export type ApplyEditsResult = { ok: true } | { ok: false; errorMessage: string; statusCode: number };

/**
 * Apply per-section trim/crop to each uploaded clip, mutating `tempVideoPaths` in place so it
 * points at the edited clips. Validation runs first (synchronously, in section order) so a
 * malformed edit rejects the request with HTTP 400 before any ffmpeg work; the ffmpeg passes
 * are independent per section, so they run concurrently and an ffmpeg runtime failure falls
 * back to the unedited clip rather than failing the whole compile.
 */
export async function applyVideoEditsToSections(
  tempVideoPaths: Record<string, string>,
  videoEdits: Record<string, VideoEdit>,
  logger: EditLogger
): Promise<ApplyEditsResult> {
  const jobs: { section: string; rawPath: string; plan: EditPlan }[] = [];

  for (const [section, rawPath] of Object.entries(tempVideoPaths)) {
    try {
      jobs.push({ section, rawPath, plan: planVideoEdit(rawPath, videoEdits[section]) });
    } catch (error) {
      // Malformed edit values are the client's fault -> reject the request.
      if (error instanceof VideoEditValidationError) {
        return {
          ok: false,
          errorMessage: `Invalid videoEdits for section "${section}": ${error.message}`,
          statusCode: 400,
        };
      }

      throw error;
    }
  }

  await Promise.all(jobs.map((job) => runSectionEdit(job, tempVideoPaths, logger)));

  return { ok: true };
}

async function runSectionEdit(
  job: { section: string; rawPath: string; plan: EditPlan },
  tempVideoPaths: Record<string, string>,
  logger: EditLogger
): Promise<void> {
  const { section, plan } = job;

  if (plan.kind === 'noop') {
    return;
  }

  try {
    await runFfmpeg(plan.args);
    tempVideoPaths[section] = plan.outputPath;
    logger.info(`Applied trim/crop for section "${section}" -> ${plan.outputPath}`);
  } catch (error) {
    // ffmpeg runtime failure: log and fall back to the unedited clip rather than failing the whole compile.
    logger.error(
      `Trim/crop failed for section "${section}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
