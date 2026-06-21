import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { VideoFile } from 'react-native-vision-camera';
import VideoRecorder from '@/src/features/editor/components/VideoRecorder';
import type { Section, Orientation } from '@/src/types';
import { parseOrientation, toDeviceOrientation } from '@/src/features/templates/orientationMeta';
import { colors, spacing, typography } from '@/src/styles/theme';
import { useProject, useSaveProject } from '@/src/hooks/useProjects';
import { useOrientation } from '@/src/hooks/useOrientation';

const safeJsonParse = (jsonString: string | undefined | null): unknown => {
  if (!jsonString) return null;

  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Failed to parse JSON string:', error);

    return null;
  }
};

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

interface RecordSectionHeaderProps {
  section: Section;
  isRecording: boolean;
  // Back is also blocked while the stopped clip finalizes, so navigation can't fire mid-save.
  backDisabled: boolean;
  recordingDuration: number;
  onBack: () => void;
  t: TFunction<'recording'>;
}

const RecordSectionHeader = ({
  section,
  isRecording,
  backDisabled,
  recordingDuration,
  onBack,
  t,
}: RecordSectionHeaderProps) => (
  <View style={styles.headerBar}>
    <TouchableOpacity style={styles.headerButton} onPress={onBack} disabled={backDisabled}>
      <Ionicons name="arrow-back" size={24} color={backDisabled ? 'rgba(255,255,255,0.5)' : 'white'} />
      <Text style={[styles.headerButtonText, backDisabled && { color: 'rgba(255,255,255,0.5)' }]}>
        {t('actions.back', { ns: 'common' })}
      </Text>
    </TouchableOpacity>

    <View style={styles.headerTitleContainer}>
      <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
        {section.title?.en ?? section.name}
      </Text>
    </View>

    {isRecording && (
      <View style={styles.timerContainer}>
        <Text style={styles.timerText}>{formatTime(recordingDuration)}</Text>
        <View style={styles.recordingIndicator} />
      </View>
    )}
  </View>
);

const buildUpdatedProject = (
  project: NonNullable<ReturnType<typeof useProject>['data']>,
  section: Section,
  video: VideoFile,
  orientation: Orientation
) => {
  const isFirstSectionRecorded = Object.keys(project.recordedVideos).length === 0;

  const updatedProject = {
    ...project,
    recordedVideos: {
      ...project.recordedVideos,
      [section.name]: {
        path: video.path,
        orientation: orientation,
        duration: (video as unknown as { duration?: number }).duration,
        width: (video as unknown as { width?: number }).width,
        height: (video as unknown as { height?: number }).height,
        recordedAt: new Date().toISOString(),
      },
    },
    updatedAt: new Date().toISOString(),
  };

  if (isFirstSectionRecorded) {
    updatedProject.thumbnailUri = video.path;
  }

  return updatedProject;
};

const useOrientationLock = (orientation: 'portrait' | 'landscape') => {
  // `orientation` here is the DEVICE orientation (square already mapped to portrait by the caller).
  const { lockOrientation, unlockOrientation } = useOrientation();

  useEffect(() => {
    lockOrientation(orientation).catch(console.error);

    return () => {
      unlockOrientation().catch(console.error);
    };
  }, [orientation, lockOrientation, unlockOrientation]);
};

const useRecordingTimer = (isRecording: boolean) => {
  const [recordingDuration, setRecordingDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    }

    if (!isRecording) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecordingDuration(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  return recordingDuration;
};

interface NavigateAfterRecordingParams {
  router: ReturnType<typeof useRouter>;
  project: NonNullable<ReturnType<typeof useProject>['data']>;
  section: Section;
  video: VideoFile;
  projectId: string;
  orientation: Orientation;
}

const navigateAfterRecording = ({
  router,
  project,
  section,
  video,
  projectId,
  orientation,
}: NavigateAfterRecordingParams) => {
  const backToEditor = () => {
    router.replace({ pathname: '/template/[id]', params: { id: project.templateName, projectId: project.id } });
  };

  const sections = project.templateContent.sections ?? [];
  const currentSectionIndex = sections.findIndex((s: Section) => s.name === section.name);

  // Only return to the editor when we can POSITIVELY confirm this was the last section
  // (so the user can hit "Create video"). In every other case — including when the section
  // isn't found because the project's stored template diverged from the live one — send the
  // user to the preview screen so they can review / trim / crop the clip they just recorded.
  const isLastSection = currentSectionIndex !== -1 && currentSectionIndex === sections.length - 1;

  if (isLastSection) {
    backToEditor();

    return;
  }

  router.push({
    pathname: '/(fullscreen)/preview',
    // Pass the TEMPLATE orientation (so square stays square): the preview locks the device to portrait
    // for a square clip but frames the clip 1:1 to match the engine's compile-time center-crop.
    params: {
      projectId,
      videoUri: video.path,
      orientation,
      sectionName: section.name,
    },
  });
};

const RecordSectionScreen = () => {
  const router = useRouter();
  const { t } = useTranslation('recording');
  const params = useLocalSearchParams<{
    projectId: string;
    sectionJson: string;
    orientation?: string;
    existingVideoPath?: string;
  }>();

  const projectId = params.projectId;
  const section = safeJsonParse(params.sectionJson) as Section | null;
  const orientation: Orientation = parseOrientation(params.orientation);
  const existingVideoPath = params.existingVideoPath;

  const { data: project } = useProject(projectId);
  const saveProjectMutation = useSaveProject();

  const [isRecording] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const recordingDuration = useRecordingTimer(isRecording);

  useOrientationLock(toDeviceOrientation(orientation));

  if (!projectId || !section) {
    console.error('RecordSectionScreen: Missing projectId or section data');
    Alert.alert(t('alerts.loadError.title'), t('alerts.loadError.message'), [
      {
        text: t('actions.ok', { ns: 'common' }),
        onPress: () => {
          router.back();
        },
      },
    ]);

    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{t('loadingError')}</Text>
      </View>
    );
  }

  const handleVideoRecorded = async (video: VideoFile) => {
    if (!project) return;

    try {
      const updatedProject = buildUpdatedProject(project, section, video, orientation);

      await saveProjectMutation.mutateAsync(updatedProject);
      navigateAfterRecording({ router, project, section, video, projectId, orientation });
    } catch (error) {
      console.error('Error saving recorded video:', error);
      Alert.alert(t('alerts.saveError.title'), t('alerts.saveError.message'));
    }
  };

  return (
    <View style={styles.fullscreenContainer}>
      <StatusBar hidden />

      <RecordSectionHeader
        section={section}
        isRecording={isRecording}
        backDisabled={isRecording || isFinalizing}
        recordingDuration={recordingDuration}
        onBack={() => {
          router.back();
        }}
        t={t}
      />

      <VideoRecorder
        orientation={orientation}
        onVideoRecorded={(video) => {
          handleVideoRecorded(video).catch(console.error);
        }}
        existingVideoUri={existingVideoPath}
        sectionDescription={section.description?.en}
        countdownSeconds={section.options?.countdown ? (section.options.countdownDuration ?? 4) : undefined}
        maxDurationSeconds={section.options?.duration}
        framingGuide={section.options?.framingGuide}
        onFinalizingChange={setIsFinalizing}
        fullscreen
      />
    </View>
  );
};

const styles = StyleSheet.create({
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  headerBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60 + (StatusBar.currentHeight ?? 0),
    paddingTop: StatusBar.currentHeight ?? 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerButtonText: {
    color: 'white',
    marginLeft: spacing.xs,
    ...typography.body,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 10,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    zIndex: 6,
  },
  timerText: {
    color: 'white',
    fontSize: 16,
    marginRight: spacing.s,
  },
  recordingIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    textAlign: 'center',
  },
});

export default RecordSectionScreen;
