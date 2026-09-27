export type RenderPhase = 'edit' | 'processing' | 'result';

interface RenderPhaseInput {
  hasResult: boolean;
  isProcessing: boolean;
  failed: boolean;
  // The user pressed Stop on this render. A Stop that lands before the engine is ready can't reach it,
  // so the render may still finish or fail afterwards; neither outcome is theirs any more.
  stopped: boolean;
}

// What the editor shell shows, read from the render itself rather than the wizard's step index (which
// once sent a failed or stopped render to an empty result screen): a finished video wins; a running or
// failed render keeps the monitor up, since a failure must stay on screen next to its way out; anything
// else — a stopped render, a saved project whose output is gone — is back to editing.
export const renderPhase = ({ hasResult, isProcessing, failed, stopped }: RenderPhaseInput): RenderPhase => {
  if (stopped) return 'edit';

  if (hasResult) return 'result';

  if (isProcessing || failed) return 'processing';

  return 'edit';
};
