export type CompilePhase = 'preparing' | 'rendering' | 'complete' | 'error';

interface CompilePhaseInput {
  isProcessing: boolean;
  percentage: number;
  error: string | null;
}

// The compile screen's honest state: an error short-circuits; before any progress it's "preparing"
// (engine init); at 100% it's complete; otherwise it's actively rendering.
export const compilePhase = ({ percentage, error }: CompilePhaseInput): CompilePhase => {
  if (error) return 'error';

  if (percentage >= 100) return 'complete';

  if (percentage <= 0) return 'preparing';

  return 'rendering';
};
