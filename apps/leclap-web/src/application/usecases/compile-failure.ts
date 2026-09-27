// Why a render produced no video, as a stable kind the interface can put in the viewer's language: the
// engine only speaks English stderr. `detail` carries the engine's own first line, verbatim, only when the
// kind can't say anything more specific; the whole error (stderr included) is logged, and kept as the
// thrown CompileError's cause.
export type CompileFailureKind = 'missingClip' | 'unreadableClip' | 'assemblyFailed' | 'stopped' | 'unknown';

export interface CompileFailure {
  kind: CompileFailureKind;
  /** The engine's first line, for a failure the app has no words of its own for. Empty otherwise. */
  detail: string;
}

// A clip FFmpeg couldn't open once it was staged into the WASM filesystem: missing, damaged, or in a
// container this build can't demux.
const UNREADABLE_CLIP =
  /moov atom not found|Invalid data found|detected only with low score|does not contain any stream/i;
// The engine ran but had nothing to hand back, or lost a file of its own on the way.
const ASSEMBLY_FAILED = /no output produced|no output generated|No such file/i;
const MAX_DETAIL = 200;

// The error a render rejects with: an English message for the logs, the failure for the interface.
export class CompileError extends Error {
  readonly failure: CompileFailure;

  constructor(failure: CompileFailure, options?: ErrorOptions) {
    super(`Render failed (${failure.kind})${failure.detail ? `: ${failure.detail}` : ''}`, options);
    this.name = 'CompileError';
    this.failure = failure;
  }
}

export const classifyCompileFailure = (error: unknown): CompileFailure => {
  if (error instanceof CompileError) return error.failure;

  const raw = error instanceof Error ? error.message : String(error);

  if (UNREADABLE_CLIP.test(raw)) return { kind: 'unreadableClip', detail: '' };

  if (ASSEMBLY_FAILED.test(raw)) return { kind: 'assemblyFailed', detail: '' };

  return { kind: 'unknown', detail: raw.split('\n')[0].trim().slice(0, MAX_DETAIL) };
};
