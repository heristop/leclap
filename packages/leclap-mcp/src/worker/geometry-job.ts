import {
  renderedGeometryWarnings,
  type RenderCheckOptions,
  type RenderedGeometry,
  type TemplateDescriptorSchema,
} from 'ffmpeg-video-composer';
import type { z } from 'zod';

// `validate_template` with `render: true`, run in the forked render worker rather than the server: the
// check renders through the engine's process-wide container, so in the worker it gets compose_video's
// timeout and a process of its own to crash or be killed in.
export interface GeometryJob {
  kind: 'geometry';
  descriptor: z.infer<typeof TemplateDescriptorSchema>;
  options: Pick<RenderCheckOptions, 'assetsDir' | 'workDir'>;
}

export type GeometryJobResult = { ok: true; geometry: RenderedGeometry } | { ok: false; error: string };

type Check = (descriptor: GeometryJob['descriptor'], options: GeometryJob['options']) => Promise<RenderedGeometry>;

// A compose job carries no `kind`, so its presence alone tells the two apart — as with progress pings.
export function isGeometryJob(job: unknown): job is GeometryJob {
  return typeof job === 'object' && job !== null && (job as { kind?: unknown }).kind === 'geometry';
}

// The check degrades a failed render to its static findings by itself; a throw that still escapes is
// reported as a failed job, so the parent falls back instead of reading a bare worker exit.
export async function runGeometryJob(
  job: GeometryJob,
  check: Check = renderedGeometryWarnings
): Promise<GeometryJobResult> {
  try {
    return { ok: true, geometry: await check(job.descriptor, job.options) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
