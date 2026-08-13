import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../..');

/**
 * Build directory for a suite that runs a real compile.
 *
 * These suites write segment renders, `segments.list` and `output.mp4` to disk under fixed names
 * derived from section names, so two runs sharing a directory overwrite each other's intermediates.
 * A per-suite name keeps sibling suites apart within one run; the pid keeps whole runs apart, which
 * a name alone cannot do — a second `vitest` started while one is going (two agents, two terminals,
 * two CI legs on one runner) otherwise interleaves writes into the same `video_1_output.mp4`, and
 * the transition step decodes a half-written file. That surfaces far from its cause, as
 * `Invalid NAL unit size` / `Error splitting the input into NAL units` from the h264 decoder.
 */
export function testBuildDir(suite: string): string {
  return path.resolve(repoRoot, `build/${suite}-${process.pid}`);
}
