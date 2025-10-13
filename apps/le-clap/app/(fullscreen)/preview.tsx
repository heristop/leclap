import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  StatusBar,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { getProjectById } from '@/src/services/api';
import { Project } from '@/src/types';
import { colors, spacing, typography } from '@/src/styles/theme';
import { useOrientation } from '@/src/hooks/useOrientation';

export default function PreviewPage() {
  const params = useLocalSearchParams<{ projectId?: string; videoUri?: string; orientation?: 'portrait' | 'landscape'; sectionName?: string }>();
  const router = useRouter();
  const { projectId, videoUri, orientation: paramOrientation, sectionName } = params;
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { lockOrientation, unlockOrientation } = useOrientation(paramOrientation);

  const requiredOrientation = paramOrientation || 'portrait';

  useEffect(() => {
    if (paramOrientation) {
      lockOrientation(paramOrientation);
    }

    return () => {
      unlockOrientation();
    };
  }, [paramOrientation, lockOrientation, unlockOrientation]);

  useEffect(() => {
    const loadProject = async () => {
      if (projectId) {
        try {
          const projectData = await getProjectById(projectId);
          if (projectData) {
            setProject(projectData);
          } else {
            setError('Project not found');
          }
        } catch (err: any) {
          setError(`Failed to load project: ${err.message}`);
          console.error('Error loading project:', err);
        }
      } else if (!videoUri) {
        setError('No project ID or video URI provided');
      }
      setIsLoading(false);
    };

    loadProject();
  }, [projectId, videoUri]);

  const handleRetake = () => {
    if (projectId && sectionName && project?.templateContent?.sections) {
      const sectionToRetake = project.templateContent.sections.find(s => s.name === sectionName);

      if (sectionToRetake) {
        router.replace({
          pathname: '/(fullscreen)/record-section',
          params: {
            projectId: projectId,
            sectionJson: JSON.stringify(sectionToRetake),
            orientation: requiredOrientation,
            retake: 'true',
          },
        });
      } else {
        console.error('Section not found for retake:', sectionName);
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(app)/videos/index');
        }
      }
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(app)/videos/index');
    }
  };

  const handleDone = () => {
    if (project?.templateName && project?.id) {
      router.replace({ pathname: '/(app)/template/[id]', params: { id: project.templateName, projectId: project.id } });
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(app)/videos/index');
    }
  };

  const player = useVideoPlayer(videoUri ?? null, (playerInstance) => {
    playerInstance.loop = true;
  });

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading preview...</Text>
      </View>
    );
  }

  if (error || (!project && !videoUri)) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error || 'Preview not available'}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isPortrait = requiredOrientation === 'portrait';

  return (
    <View style={styles.fullscreenContainer}>
      <StatusBar hidden={true} translucent={true} backgroundColor="transparent" />

      {videoUri && player ? (
        <View style={[styles.videoContainer, isPortrait ? styles.portraitVideoContainer : styles.landscapeVideoContainer]}>
          <VideoView
            style={styles.videoPlayer}
            player={player}
            nativeControls={true}
            contentFit="contain"
          />
          <View style={[styles.overlayButtonsContainer, isPortrait ? styles.portraitOverlayButtonsContainer : styles.landscapeOverlayButtonsContainer]}>
            {projectId && project?.templateName && (
              <TouchableOpacity style={styles.retakeButton} onPress={handleRetake}>
                <Ionicons name="refresh" size={20} color={colors.surface} />
                <Text style={styles.retakeButtonText}>Retake</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity 
            style={styles.fullscreenCloseButton} 
            onPress={handleDone}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={36} color="#000000" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Video not available for preview.</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.body,
    marginTop: spacing.m,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    marginBottom: spacing.l,
    textAlign: 'center',
  },
  backButton: {
    padding: spacing.s,
  },
  backButtonText: {
    ...typography.body,
    color: colors.primary,
  },
  videoContainer: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  portraitVideoContainer: {
    width: '100%',
    height: '100%',
  },
  landscapeVideoContainer: {
    width: '100%',
    height: '100%',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  fullscreenCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 2000,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  overlayButtonsContainer: {
    position: 'absolute',
    zIndex: 2000,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  portraitOverlayButtonsContainer: {
    bottom: 50,
    left: 0,
    right: 0,
  },
  landscapeOverlayButtonsContainer: {
    right: 50,
    bottom: 0,
    top: 0,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.error,
    paddingVertical: spacing.m + 2,
    paddingHorizontal: spacing.m,
    borderRadius: 8,
    minHeight: 48,
  },
  retakeButtonText: {
    ...typography.body,
    color: colors.surface,
    marginLeft: spacing.s,
  },
});
