import { useEffect, useState } from 'react';

export interface BrowserSupportCheck {
  name: string;
  ok: boolean;
}

// Capabilities the in-browser record → compile flow needs: a camera to record the intro, the
// WASM + cross-origin-isolated threading stack ffmpeg.wasm runs on, and the File API for the clip.
// Evaluated once on mount (client-only globals) so the onboarding can gate "Create my intro" on a
// browser that can actually finish the flow, instead of failing mid-way.
// `navigator.mediaDevices` is typed non-nullish but is undefined in insecure contexts.
const supportsCamera = (): boolean => {
  const devices = navigator.mediaDevices as MediaDevices | undefined;

  if (!devices) {
    return false;
  }

  return 'getUserMedia' in devices;
};

const evaluateSupport = (): BrowserSupportCheck[] => [
  { name: 'Camera access', ok: supportsCamera() },
  {
    name: 'In-browser video engine',
    ok: typeof WebAssembly === 'object' && typeof SharedArrayBuffer !== 'undefined' && crossOriginIsolated,
  },
  { name: 'File handling', ok: typeof File !== 'undefined' && typeof FileReader !== 'undefined' },
];

export const useBrowserSupport = () => {
  const [checks, setChecks] = useState<BrowserSupportCheck[] | null>(null);

  useEffect(() => {
    setChecks(evaluateSupport());
  }, []);

  return {
    checks,
    checking: checks === null,
    ready: checks?.every((check) => check.ok) ?? false,
  };
};
