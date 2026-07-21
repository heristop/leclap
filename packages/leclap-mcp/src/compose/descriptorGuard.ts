import path from 'node:path';

import type { TemplateDescriptor } from 'ffmpeg-video-composer';

import { assertWithinMediaDir } from './pathGuard.js';

// compose_video schema-validates the descriptor but then forwards its filter chain to ffmpeg
// VERBATIM (FilterSchema.type is a raw filter name, fontfile is a raw "Path or URL"). Only
// userVideoPaths get the media-dir guard, so without this an agent-supplied template can reach the
// host filesystem/network THROUGH the filtergraph, sidestepping the sandbox:
//   • an ffmpeg SOURCE filter (`movie`/`amovie`) opens an arbitrary local file or, via its protocol
//     support (http/https/…), a network URL → arbitrary read + SSRF.
//   • a `fontfile` absolute path / traversal points drawtext at a file outside the media dir.
// This guard walks the whole descriptor, rejecting source filters and containing every fontfile
// path, before the descriptor is handed to the worker.

// Source filters read an external resource (file or, for movie/amovie, any ffmpeg protocol incl.
// http). A normal template never needs one — clips arrive as sections/inputs, which ARE guarded.
const SOURCE_FILTERS = new Set(['movie', 'amovie']);

export type GuardResult = { ok: true } | { ok: false; message: string };

// Recursively yield every plain object node in the descriptor (arrays and objects), so the walk
// catches filters wherever they live: section filters, per-input filters, and map filter chains.
function* objectNodes(value: unknown): Generator<Record<string, unknown>> {
  if (Array.isArray(value)) {
    for (const item of value) {
      yield* objectNodes(item);
    }

    return;
  }

  if (value === null || typeof value !== 'object') {
    return;
  }

  const record = value as Record<string, unknown>;
  yield record;

  for (const child of Object.values(record)) {
    yield* objectNodes(child);
  }
}

// A bare bundled font name (e.g. "BebasNeue.ttf") has no path separator and no traversal — those
// resolve from the engine's font registry and are safe. Anything path-like must be contained.
function fontfileNeedsContainment(fontfile: string): boolean {
  return fontfile.includes('/') || fontfile.includes('\\') || fontfile.includes('..') || path.isAbsolute(fontfile);
}

// Section/transition `type` values are enum-constrained by the schema (already validated), so a
// `type` equal to a source-filter name can only be a raw filter entry — no false positives.
function findSourceFilter(descriptor: TemplateDescriptor): string | undefined {
  for (const node of objectNodes(descriptor)) {
    const type = node.type;

    if (typeof type === 'string' && SOURCE_FILTERS.has(type.trim().toLowerCase())) {
      return type;
    }
  }

  return undefined;
}

function collectFontfiles(descriptor: TemplateDescriptor): string[] {
  const files: string[] = [];

  for (const node of objectNodes(descriptor)) {
    if (typeof node.fontfile === 'string') {
      files.push(node.fontfile);
    }
  }

  return files;
}

// Reject source filters and confirm every path-like fontfile stays under the media dir. Async
// because containment is realpath-checked (symlink-safe) via the same guard userVideoPaths use.
export async function assertDescriptorSafe(descriptor: TemplateDescriptor, mediaDir: string): Promise<GuardResult> {
  const sourceFilter = findSourceFilter(descriptor);

  if (sourceFilter) {
    return {
      ok: false,
      message: `Filter "${sourceFilter}" is not allowed: source filters can read arbitrary files or URLs. Supply media via userVideoPaths (checked against the media dir) instead.`,
    };
  }

  const pathLike = collectFontfiles(descriptor).filter(fontfileNeedsContainment);
  const checks = await Promise.all(pathLike.map((fontfile) => containFontfile(fontfile, mediaDir)));
  const failure = checks.find((message) => message !== undefined);

  if (failure) {
    return { ok: false, message: failure };
  }

  return { ok: true };
}

// Realpath-contain one path-like fontfile; returns an error message on escape, undefined when safe.
async function containFontfile(fontfile: string, mediaDir: string): Promise<string | undefined> {
  try {
    await assertWithinMediaDir(fontfile, mediaDir);

    return undefined;
  } catch (error) {
    return `fontfile ${error instanceof Error ? error.message : String(error)}`;
  }
}
