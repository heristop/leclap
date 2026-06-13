// React glue around the pure builderMode helpers: a hook that reads localStorage once, persists on
// change, plus a context so deeply-nested section fields can read the mode without prop-drilling.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { readBuilderMode, writeBuilderMode, type BuilderMode } from './builderMode';

const storage = (): Storage | undefined => (typeof window === 'undefined' ? undefined : window.localStorage);

export function useBuilderMode(): [BuilderMode, (mode: BuilderMode) => void] {
  const [mode, setMode] = useState<BuilderMode>(() => readBuilderMode(storage()));

  useEffect(() => {
    writeBuilderMode(storage(), mode);
  }, [mode]);

  return [mode, setMode];
}

const BuilderModeContext = createContext<BuilderMode>('simple');

export const BuilderModeProvider = ({ mode, children }: { mode: BuilderMode; children: ReactNode }) => (
  <BuilderModeContext value={mode}>{children}</BuilderModeContext>
);

// True when the editor is in Advanced mode — used to gate the per-section disclosure toggles.
export const useIsAdvanced = (): boolean => useContext(BuilderModeContext) === 'advanced';
