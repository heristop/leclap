import { writeFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { RenderManifest } from 'ffmpeg-video-composer';

// `leclap render --manifest`: the render manifest (template, graph, asset and output digests) is written
// next to the video, so `leclap verify` can later prove the file is still that render.

export function manifestPathFor(video: string): string {
  return `${video}.manifest.json`;
}

export function writeManifest(video: string, manifest: RenderManifest): string {
  const target = manifestPathFor(video);
  writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`);

  return target;
}

// Copy the engine's `build/output.mp4` to the user's `--output` path (engine output naming is fixed;
// per-render placement is the CLI's concern). Returns the path the summary should report.
export async function finalizeOutput(result: string, outputAbs: string | undefined): Promise<string> {
  if (!outputAbs) return result;

  await fs.mkdir(path.dirname(outputAbs), { recursive: true });
  await fs.copyFile(result, outputAbs);

  return outputAbs;
}
