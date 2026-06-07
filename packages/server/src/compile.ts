import * as fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { FastifyRequest } from 'fastify';
import { compile as coreCompile, type TemplateDescriptor } from 'ffmpeg-video-composer';
import { applyVideoEditsToSections, type VideoEdit } from './videoEdit.js';

// __dirname for this ES module. Mirrors index.js: dist/compile.js lives beside dist/index.js,
// so `../build` resolves to packages/server/build exactly as before.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Logger surface shared with Fastify's logger (a subset of its methods).
export interface CompileLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

// Define interfaces for stronger typing
export interface VideoFile {
  path: string;
  section: string;
  dir?: string; // Optional: Only for temporary files
  tempDir?: string; // Directory for temporary request-specific files
  permanent?: boolean; // Flag to indicate if file should be kept
}

export interface CompileDirectories {
  buildDir: string;
  tmpDir: string;
  requestTempDir: string;
  videosDir: string;
}

interface ProcessedParts {
  templateJson: unknown;
  videoFiles: VideoFile[];
  tempVideoPaths: Record<string, string>;
  videoEdits: Record<string, VideoEdit>;
  partCount: number;
  fieldCount: number;
  fileCount: number;
}

export interface CompileOutcome {
  success: boolean;
  outputPath: string | null;
  errorMessage?: string;
  statusCode?: number;
}

function ensureDirSync(dirPath: string): void {
  if (!fsSync.existsSync(dirPath)) {
    fsSync.mkdirSync(dirPath, { recursive: true });
  }
}

export function buildCompileDirs(requestUid: string): CompileDirectories {
  const buildDir = path.resolve(__dirname, '../build');
  const tmpDir = path.join(buildDir, 'tmp');
  const requestTempDir = path.join(tmpDir, requestUid);
  const videosDir = path.join(requestTempDir, 'videos');

  return { buildDir, tmpDir, requestTempDir, videosDir };
}

function ensureCompileDirs(dirs: CompileDirectories): void {
  ensureDirSync(dirs.tmpDir);
  ensureDirSync(dirs.requestTempDir);
  ensureDirSync(dirs.videosDir);
}

function parseTemplatePart(value: unknown): unknown {
  return JSON.parse(String(value)) as unknown;
}

async function processFilePart(
  part: { filename: string; toBuffer: () => Promise<Buffer> },
  fileCount: number,
  requestUid: string,
  logger: CompileLogger
): Promise<{ videoFile: VideoFile; sectionName: string; videoPath: string }> {
  const filenameMatch = part.filename.match(/^([^-]+)-\d+\.(\w+)$/);
  const sectionName = filenameMatch ? filenameMatch[1] : 'unknown_section';

  logger.info(`Received video file #${fileCount} for section ${sectionName}: ${part.filename}`);

  const dirs = buildCompileDirs(requestUid);
  ensureCompileDirs(dirs);

  const fileExtension = filenameMatch ? filenameMatch[2] : 'mov';
  const videoPath = path.join(dirs.videosDir, `${sectionName}.${fileExtension}`);

  const fileBuffer = await part.toBuffer();
  fsSync.writeFileSync(videoPath, fileBuffer);

  logger.info(`Saved video for section ${sectionName} to ${videoPath}`);

  return {
    videoFile: { path: videoPath, section: sectionName, tempDir: dirs.requestTempDir },
    sectionName,
    videoPath,
  };
}

// Mutable accumulator threaded through the multipart loop, kept here so the loop body stays
// small enough for the per-function statement budget.
interface PartsAccumulator {
  templateJson: unknown;
  videoFiles: VideoFile[];
  tempVideoPaths: Record<string, string>;
  videoEdits: Record<string, VideoEdit>;
  partCount: number;
  fileCount: number;
  fieldCount: number;
}

function handleTemplateField(value: unknown, acc: PartsAccumulator): void {
  acc.fieldCount++;
  acc.templateJson = parseTemplatePart(value);
}

function handleVideoEditsField(value: unknown, acc: PartsAccumulator, logger: CompileLogger): void {
  acc.fieldCount++;

  try {
    acc.videoEdits = JSON.parse(String(value)) as Record<string, VideoEdit>;
  } catch (error) {
    logger.warn(`Could not parse videoEdits field: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function handleFilePart(
  part: { filename: string; toBuffer: () => Promise<Buffer> },
  requestUid: string,
  acc: PartsAccumulator,
  logger: CompileLogger
): Promise<void> {
  acc.fileCount++;
  const result = await processFilePart(part, acc.fileCount, requestUid, logger);
  acc.tempVideoPaths[result.sectionName] = result.videoPath;
  acc.videoFiles.push(result.videoFile);
}

async function processMultiparts(
  request: FastifyRequest,
  requestUid: string,
  logger: CompileLogger
): Promise<ProcessedParts> {
  const parts = request.parts();
  const acc: PartsAccumulator = {
    templateJson: null,
    videoFiles: [],
    tempVideoPaths: {},
    videoEdits: {},
    partCount: 0,
    fileCount: 0,
    fieldCount: 0,
  };

  for await (const part of parts) {
    acc.partCount++;

    if (part.type === 'field' && part.fieldname === 'template') {
      handleTemplateField(part.value, acc);
      continue;
    }

    // Per-section trim/crop chosen on the device: { "<section>": { trimStart, trimEnd, crop } }
    if (part.type === 'field' && part.fieldname === 'videoEdits') {
      handleVideoEditsField(part.value, acc, logger);
      continue;
    }

    if (part.type === 'file') {
      await handleFilePart(part, requestUid, acc, logger);
    }
  }

  return acc;
}

export function copyOutputToPersistentLocation(outputPath: string, buildDir: string, logger: CompileLogger): void {
  try {
    const fileName = path.basename(outputPath);
    const persistentPath = path.join(buildDir, fileName);

    if (outputPath !== persistentPath) {
      logger.info(`Copying output file from ${outputPath} to ${persistentPath}`);
      fsSync.copyFileSync(outputPath, persistentPath);
    }
  } catch (copyError) {
    const message = copyError instanceof Error ? copyError.message : String(copyError);
    logger.error(`Error copying output file: ${message}`);
  }
}

export function cleanupTempDir(buildDir: string, requestUid: string, logger: CompileLogger): void {
  try {
    const tmpDir = path.join(buildDir, 'tmp');
    const tempDir = path.join(tmpDir, requestUid);

    if (fsSync.existsSync(tempDir)) {
      fsSync.rmSync(tempDir, { recursive: true, force: true });
    }
  } catch (cleanupError) {
    const message = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
    logger.error(`Error cleaning up temporary directory: ${message}`);
  }
}

async function runCompilation(
  requestUid: string,
  templateJson: unknown,
  tempVideoPaths: Record<string, string>,
  logger: CompileLogger
): Promise<string | null> {
  const dirs = buildCompileDirs(requestUid);
  ensureCompileDirs(dirs);

  const projectConfig = {
    buildDir: dirs.buildDir,
    assetsDir: dirs.requestTempDir,
    userVideoPaths: tempVideoPaths,
  };

  return coreCompile(projectConfig, templateJson as TemplateDescriptor);
}

// Reject the request unless the template is present and any required uploads were provided.
// Returns a failure outcome to send, or null when the request passes validation.
function validateCompileRequest(
  templateJson: unknown,
  videoFiles: VideoFile[]
): CompileOutcome | null {
  if (!templateJson) {
    return { success: false, outputPath: null, errorMessage: 'Template JSON missing in request', statusCode: 400 };
  }

  // Only templates with `project_video` sections need user-recorded clips. Templates built
  // solely from color backgrounds / text / pictures compile without any upload, so don't
  // reject those for having no files.
  const sections = (templateJson as { sections?: { type?: string }[] }).sections ?? [];
  const requiresVideoUpload = sections.some((s) => s.type === 'project_video');

  if (requiresVideoUpload && videoFiles.length === 0) {
    return { success: false, outputPath: null, errorMessage: 'No video files uploaded', statusCode: 400 };
  }

  return null;
}

export async function handleCompileRequest(
  request: FastifyRequest,
  dirs: CompileDirectories,
  logger: CompileLogger
): Promise<CompileOutcome> {
  const requestUid = dirs.requestTempDir.split('/').pop() ?? 'unknown';
  const { templateJson, videoFiles, tempVideoPaths, videoEdits, partCount, fieldCount, fileCount } =
    await processMultiparts(request, requestUid, logger);

  logger.info(`Multipart processing complete: ${partCount} total parts, ${fieldCount} fields, ${fileCount} files`);

  const validationFailure = validateCompileRequest(templateJson, videoFiles);

  if (validationFailure) {
    return validationFailure;
  }

  // Apply the user's trim/crop (selected on the device) to each clip before compilation.
  const editsResult = await applyVideoEditsToSections(tempVideoPaths, videoEdits, logger);

  if (!editsResult.ok) {
    return { success: false, outputPath: null, errorMessage: editsResult.errorMessage, statusCode: editsResult.statusCode };
  }

  const compiledPath = await runCompilation(requestUid, templateJson, tempVideoPaths, logger);

  if (!compiledPath) {
    logger.error('Compilation failed.');

    return { success: false, outputPath: null, errorMessage: 'Compilation failed internally', statusCode: 500 };
  }

  logger.info(`Compilation successful. Output: ${compiledPath}`);

  return { success: true, outputPath: compiledPath };
}
