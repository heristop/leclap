import { useState, useEffect, useRef, useOptimistic, startTransition } from 'react';
// Type-only import (erased at build) + dynamic import below, so the heavy WASM lib code-splits into its
// own chunk rather than the entry bundle — see videoEdits.ts and the engine's FFmpegWasmAdapter.
import type { FFmpeg } from '@ffmpeg/ffmpeg';
import { ffmpegLogger } from '@/lib/logger';

interface FFmpegState {
  isReady: boolean;
  isLoading: boolean;
  loadingProgress: number;
  error: string | null;
}

// Load the ffmpeg.wasm core lazily — the libs are dynamically imported so they code-split out of the
// entry bundle. Reports coarse progress (25/50/75/90) through the callback as each asset resolves.
async function loadCoreFFmpeg(onProgress: (percent: number) => void): Promise<FFmpeg> {
  const [{ FFmpeg }, { toBlobURL }] = await Promise.all([import('@ffmpeg/ffmpeg'), import('@ffmpeg/util')]);
  const ffmpeg = new FFmpeg();

  ffmpeg.on('progress', ({ progress, time }) => {
    ffmpegLogger.log(`Processing: ${Math.round(progress * 100)}% (${time}s)`);
  });

  ffmpeg.on('log', ({ message }) => {
    ffmpegLogger.log('FFmpeg log:', message);

    if (message.includes('Loading')) onProgress(25);
  });

  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  onProgress(50);
  const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
  onProgress(75);
  const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
  onProgress(90);
  await ffmpeg.load({ coreURL, wasmURL });

  return ffmpeg;
}

export const useFFmpeg = () => {
  const [state, setState] = useState<FFmpegState>({
    isReady: false,
    isLoading: false,
    loadingProgress: 0,
    error: null,
  });

  const [optimisticState, setOptimisticState] = useOptimistic(
    state,
    (currentState, optimisticUpdate: Partial<FFmpegState>) => ({
      ...currentState,
      ...optimisticUpdate,
    })
  );

  const ffmpegRef = useRef<FFmpeg | null>(null);

  useEffect(() => {
    const loadFFmpeg = async () => {
      if (ffmpegRef.current) return;

      // Optimistically show loading state
      startTransition(() => {
        setOptimisticState({ isLoading: true, loadingProgress: 5 });
      });

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        ffmpegRef.current = await loadCoreFFmpeg((loadingProgress) => {
          startTransition(() => {
            setOptimisticState({ loadingProgress });
          });
        });

        startTransition(() => {
          setState((prev) => ({ ...prev, isReady: true, isLoading: false, loadingProgress: 100 }));
        });

        ffmpegLogger.success('FFmpeg loaded');
      } catch (error) {
        ffmpegLogger.error('Failed to load FFmpeg:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to load FFmpeg';
        setState((prev) => ({ ...prev, error: errorMessage, isLoading: false, loadingProgress: 0 }));
      }
    };

    loadFFmpeg().catch((error: unknown) => {
      ffmpegLogger.error('Unhandled error in loadFFmpeg:', error);
    });

    return () => {
      if (ffmpegRef.current) {
        ffmpegRef.current = null;
      }
    };
    // setOptimisticState is a stable setter from useOptimistic, so the effect still runs once.
  }, [setOptimisticState]);

  return {
    ffmpeg: ffmpegRef.current,
    isReady: optimisticState.isReady,
    isLoading: optimisticState.isLoading,
    loadingProgress: optimisticState.loadingProgress,
    error: optimisticState.error,
  };
};
