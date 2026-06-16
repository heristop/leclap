import { useEffect, useRef, useState } from 'react';
import type { Project } from '@/src/types';
import type { NormalizedCrop } from '@/src/features/editor/components/CropOverlay';
import type { TrimRange } from '@/src/features/editor/components/TrimPanel';
import { type EditMode, FULL_CROP } from './previewHelpers';
import type { PreviewPlayer } from './usePreviewPlayer';

interface UsePreviewStateArgs {
  player: PreviewPlayer;
  project: Project | null | undefined;
  sectionName: string | undefined;
  duration: number;
  currentTime: number;
  status: string;
}

export interface PreviewState {
  mode: EditMode;
  crop: NormalizedCrop;
  trim: TrimRange;
  setCrop: (next: NormalizedCrop) => void;
  setTrim: (next: TrimRange) => void;
  enterMode: (next: EditMode) => void;
  cancelMode: () => void;
  applyMode: () => void;
  resetCrop: () => void;
}

/**
 * Owns the trim/crop editing state machine for the preview screen: seeds edits
 * from the saved section, loops playback within the trim window, pauses while
 * editing, and supports entering / cancelling / applying an edit mode.
 */
export function usePreviewState({
  player,
  project,
  sectionName,
  duration,
  currentTime,
  status,
}: UsePreviewStateArgs): PreviewState {
  const [mode, setMode] = useState<EditMode>('view');
  const [crop, setCrop] = useState<NormalizedCrop>(FULL_CROP);
  const [trim, setTrim] = useState<TrimRange>({ start: 0, end: 0 });
  // Snapshot to restore when the user cancels an edit mode.
  const snapshot = useRef<{ crop: NormalizedCrop; trim: TrimRange } | null>(null);
  // Guard so we only seed trim/crop from the saved project once.
  const seeded = useRef(false);

  // Seed trim/crop from the saved section (and default trim end to the clip duration) once ready.
  useEffect(() => {
    if (seeded.current || !sectionName) return;

    const saved = project?.recordedVideos[sectionName];

    if (duration > 0) {
      setTrim(saved?.trim ?? { start: 0, end: duration });

      if (saved?.crop) {
        setCrop(saved.crop);
      }

      seeded.current = true;
    }
  }, [project, sectionName, duration, status]);

  // Loop playback within the trim window during preview.
  useEffect(() => {
    if (mode !== 'view') return;

    if (duration > 0 && currentTime >= trim.end - 0.05 && trim.end > 0) {
      player.currentTime = trim.start;
    }
  }, [currentTime, trim, duration, mode, player]);

  // Pause while editing (stable frame for cropping / seeking); resume in view mode.
  useEffect(() => {
    if (mode === 'view') {
      player.play();

      return;
    }

    player.pause();
  }, [mode, player]);

  const enterMode = (next: EditMode) => {
    snapshot.current = { crop, trim };
    setMode(next);
  };

  const cancelMode = () => {
    if (snapshot.current) {
      setCrop(snapshot.current.crop);
      setTrim(snapshot.current.trim);
    }

    setMode('view');
  };

  const applyMode = () => {
    setMode('view');
  };

  const resetCrop = () => {
    setCrop(FULL_CROP);
  };

  return { mode, crop, trim, setCrop, setTrim, enterMode, cancelMode, applyMode, resetCrop };
}
