import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { VideoView } from 'expo-video';
import { useProject, useSaveProject } from '@/src/hooks/useProjects';
import CropOverlay from '@/app/features/editor/components/CropOverlay';
import { buildErrorMessage, isCropApplied, isTrimApplied } from '@/app/features/editor/preview/previewHelpers';
import { styles } from '@/app/features/editor/preview/previewStyles';
import { usePreviewPlayer } from '@/app/features/editor/preview/usePreviewPlayer';
import { usePreviewState } from '@/app/features/editor/preview/usePreviewState';
import { usePreviewActions } from '@/app/features/editor/preview/usePreviewActions';
import { useVideoRect } from '@/app/features/editor/preview/useVideoRect';
import { useLockedOrientation } from '@/app/features/editor/preview/useLockedOrientation';
import { PreviewToolbar } from '@/app/features/editor/preview/PreviewToolbar';
import { TrimEditPanel, CropEditPanel } from '@/app/features/editor/preview/EditPanels';
import { PreviewLoading, PreviewError, PreviewNoVideo } from '@/app/features/editor/preview/PreviewStates';

export default function PreviewPage() {
  const params = useLocalSearchParams<{ projectId?: string; videoUri?: string; orientation?: 'portrait' | 'landscape'; sectionName?: string }>();
  const router = useRouter();
  const { projectId, videoUri, orientation: paramOrientation, sectionName } = params;

  const { data: project, isLoading: projectLoading, error: projectError } = useProject(projectId ?? '');
  const saveProjectMutation = useSaveProject();

  const requiredOrientation = useLockedOrientation(paramOrientation);

  const { player, currentTime, duration, srcSize, status } = usePreviewPlayer(videoUri);

  const { mode, crop, trim, setCrop, setTrim, enterMode, cancelMode, applyMode, resetCrop } = usePreviewState({
    player,
    project,
    sectionName,
    duration,
    currentTime,
    status,
  });

  const { canEdit, saving, handleRetake, handleDone } = usePreviewActions({
    project,
    projectId,
    sectionName,
    requiredOrientation,
    saveProjectMutation,
    trim,
    crop,
    duration,
  });

  const { videoRect, containerWidth, onContainerLayout } = useVideoRect(srcSize, requiredOrientation);

  const isLoading = projectId ? projectLoading : false;

  if (isLoading) {
    return <PreviewLoading />;
  }

  const errorMessage = buildErrorMessage(projectError, projectId, videoUri, project);

  if (errorMessage ?? (!project && !videoUri)) {
    return <PreviewError message={errorMessage ?? 'Preview not available'} onBack={() => { router.back(); }} />;
  }

  if (!videoUri) {
    return <PreviewNoVideo onBack={() => { router.back(); }} />;
  }

  return (
    <View style={styles.fullscreenContainer}>
      <StatusBar hidden translucent backgroundColor="transparent" />

      <View style={styles.videoArea} onLayout={onContainerLayout}>
        <VideoView
          style={StyleSheet.absoluteFill}
          player={player}
          nativeControls={mode === 'view'}
          contentFit="contain"
        />

        {mode === 'crop' && containerWidth > 0 && (
          <CropOverlay videoRect={videoRect} crop={crop} onChange={setCrop} />
        )}
      </View>

      {mode === 'view' && (
        <PreviewToolbar
          saving={saving}
          canEdit={canEdit}
          trimActive={isTrimApplied(trim, duration)}
          cropActive={isCropApplied(crop)}
          onDone={() => { handleDone().catch(console.error); }}
          onTrim={() => { enterMode('trim'); }}
          onCrop={() => { enterMode('crop'); }}
          onRetake={handleRetake}
        />
      )}

      {mode === 'trim' && (
        <TrimEditPanel
          duration={duration}
          value={trim}
          currentTime={currentTime}
          onChange={setTrim}
          onSeek={(s) => { player.currentTime = s; }}
          onCancel={cancelMode}
          onApply={applyMode}
        />
      )}

      {mode === 'crop' && (
        <CropEditPanel onReset={resetCrop} onCancel={cancelMode} onApply={applyMode} />
      )}
    </View>
  );
}
