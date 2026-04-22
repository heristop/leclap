import { useState, useEffect, useRef, useOptimistic, startTransition } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { ffmpegLogger } from '../lib/logger';

interface FFmpegState {
  isReady: boolean;
  isLoading: boolean;
  loadingProgress: number;
  error: string | null;
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
        const ffmpeg = new FFmpeg();

        // Track FFmpeg processing progress
        ffmpeg.on('progress', ({ progress, time }) => {
          ffmpegLogger.log(`Processing: ${Math.round(progress * 100)}% (${time}s)`);
        });

        ffmpeg.on('log', ({ message }) => {
          ffmpegLogger.log('FFmpeg log:', message);
          // Update loading progress based on log messages
          if (message.includes('Loading')) {
            startTransition(() => {
              setOptimisticState({ loadingProgress: 25 });
            });
          }
        });

        // Load FFmpeg WebAssembly and track loading progress
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

        startTransition(() => {
          setOptimisticState({ loadingProgress: 50 });
        });

        const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');

        startTransition(() => {
          setOptimisticState({ loadingProgress: 75 });
        });

        const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');

        startTransition(() => {
          setOptimisticState({ loadingProgress: 90 });
        });

        await ffmpeg.load({ coreURL, wasmURL });

        ffmpegRef.current = ffmpeg;

        // Complete loading with transition
        startTransition(() => {
          setState((prev) => ({
            ...prev,
            isReady: true,
            isLoading: false,
            loadingProgress: 100,
          }));
        });

        ffmpegLogger.success('FFmpeg loaded');
      } catch (err) {
        ffmpegLogger.error('Failed to load FFmpeg:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to load FFmpeg';
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isLoading: false,
          loadingProgress: 0,
        }));
      }
    };

    loadFFmpeg();

    // Cleanup on unmount
    return () => {
      if (ffmpegRef.current) {
        ffmpegRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // setOptimisticState is stable (from useOptimistic) and doesn't need to be in deps

  return {
    ffmpeg: ffmpegRef.current,
    isReady: optimisticState.isReady,
    isLoading: optimisticState.isLoading,
    loadingProgress: optimisticState.loadingProgress,
    error: optimisticState.error,
  };
};
