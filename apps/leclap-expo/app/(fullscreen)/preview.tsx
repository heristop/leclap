import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { VideoView } from 'expo-video';
import { useProject, useSaveProject } from '@/src/hooks/useProjects';
import CropOverlay from '@/src/features/editor/components/CropOverlay';
import { buildErrorMessage, isCropApplied, isTrimApplied } from '@/src/features/editor/preview/previewHelpers';
import { styles } from '@/src/features/editor/preview/previewStyles';
import { usePreviewPlayer } from '@/src/features/editor/preview/usePreviewPlayer';
import { usePreviewState } from '@/src/features/editor/preview/usePreviewState';
import { usePreviewActions } from '@/src/features/editor/preview/usePreviewActions';
import { useVideoRect } from '@/src/features/editor/preview/useVideoRect';
import { useLockedOrientation } from '@/src/features/editor/preview/useLockedOrientation';
import { PreviewToolbar } from '@/src/features/editor/preview/PreviewToolbar';
import { TrimEditPanel, CropEditPanel } from '@/src/features/editor/preview/EditPanels';
import { PreviewLoading, PreviewError, PreviewNoVideo } from '@/src/features/editor/preview/PreviewStates';

// Resolve the guard/early-return screen (loading / error / no-video) before the main editor renders.
// Returns null when the editor itself should render. Kept out of the component to cap its complexity.
function renderPreviewGuard(args: {
  isLoading: boolean;
  errorMessage: string | null;
  project: ReturnType<typeof useProject>['data'];
  videoUri: string | undefined;
  onBack: () => void;
}): React.ReactElement | null {
  const { isLoading, errorMessage, project, videoUri, onBack } = args;

  if (isLoading) {
    return <PreviewLoading />;
  }

  if (errorMessage ?? (!project && !videoUri)) {
    return <PreviewError message={errorMessage ?? 'Preview not available'} onBack={onBack} />;
  }

  if (!videoUri) {
    return <PreviewNoVideo onBack={onBack} />;
  }

  return null;
}

export default function PreviewPage() {
  const params = useLocalSearchParams<{
    projectId?: string;
    videoUri?: string;
    orientation?: 'portrait' | 'landscape' | 'square';
    sectionName?: string;
  }>();
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
  const errorMessage = buildErrorMessage(projectError, projectId, videoUri, project);

  const guard = renderPreviewGuard({
    isLoading,
    errorMessage,
    project,
    videoUri,
    onBack: () => {
      router.back();
    },
  });

  if (guard) {
    return guard;
  }

  return (
    <View style={styles.fullscreenContainer}>
      <StatusBar hidden translucent backgroundColor="transparent" />

      <View style={styles.videoArea} onLayout={onContainerLayout}>
        {requiredOrientation === 'square' && mode !== 'crop' ? (
          // A square template records portrait, then the engine center-crops to 1:1 — so frame the
          // clip in a 1:1 box with cover here, making the preview match the rendered output.
          <View style={squareStyles.center}>
            <View style={squareStyles.frame}>
              <VideoView
                style={StyleSheet.absoluteFill}
                player={player}
                nativeControls={mode === 'view'}
                contentFit="cover"
              />
            </View>
          </View>
        ) : (
          <VideoView
            style={StyleSheet.absoluteFill}
            player={player}
            nativeControls={mode === 'view'}
            contentFit="contain"
          />
        )}

        {mode === 'crop' && containerWidth > 0 && <CropOverlay videoRect={videoRect} crop={crop} onChange={setCrop} />}
      </View>

      {mode === 'view' && (
        <PreviewToolbar
          saving={saving}
          canEdit={canEdit}
          trimActive={isTrimApplied(trim, duration)}
          cropActive={isCropApplied(crop)}
          onDone={() => {
            handleDone().catch(console.error);
          }}
          onTrim={() => {
            enterMode('trim');
          }}
          onCrop={() => {
            enterMode('crop');
          }}
          onRetake={handleRetake}
        />
      )}

      {mode === 'trim' && (
        <TrimEditPanel
          duration={duration}
          value={trim}
          currentTime={currentTime}
          onChange={setTrim}
          onSeek={(s) => {
            player.currentTime = s;
          }}
          onCancel={cancelMode}
          onApply={applyMode}
        />
      )}

      {mode === 'crop' && <CropEditPanel onReset={resetCrop} onCancel={cancelMode} onApply={applyMode} />}
    </View>
  );
}

const squareStyles = StyleSheet.create({
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center' },
  frame: { width: '100%', aspectRatio: 1, overflow: 'hidden', backgroundColor: 'black' },
});
