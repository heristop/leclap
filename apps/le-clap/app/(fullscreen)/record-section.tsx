import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { VideoFile } from 'react-native-vision-camera';
import VideoRecorder from '@/app/features/editor/components/VideoRecorder';
import { Section } from '@/app/types';
import { colors, spacing, typography } from '@/app/styles/theme';
import { saveProject, getProjectById } from '@/app/services/api';
import { useOrientation } from '@/app/hooks/useOrientation';

// Helper function to parse JSON safely
const safeJsonParse = (jsonString: string | undefined | null): any | null => {
  if (!jsonString) return null;
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("Failed to parse JSON string:", e);
    return null;
  }
};

// Helper function to format time
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const RecordSectionScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{
    projectId: string;
    sectionJson: string;
    orientation: 'portrait' | 'landscape';
    existingVideoPath?: string;
  }>();

  const projectId = params.projectId;
  const section = safeJsonParse(params.sectionJson) as Section | null;
  const orientation = params.orientation || 'portrait';
  const existingVideoPath = params.existingVideoPath;

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { lockOrientation, unlockOrientation } = useOrientation();

  useEffect(() => {
    lockOrientation(orientation); // Lock to the required orientation on mount
    return () => {
      unlockOrientation(); // Unlock on unmount
    };
  }, [orientation, lockOrientation, unlockOrientation]); // Depend on orientation and lock/unlock functions

  // Timer logic
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecordingDuration(0); // Reset timer when not recording
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]); // Depend on isRecording state

  if (!projectId || !section) {
    // Handle error: Missing required parameters
    console.error('RecordSectionScreen: Missing projectId or section data');
    Alert.alert('Error', 'Could not load recording screen. Missing data.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error loading recording screen.</Text>
      </View>
    );
  }

  const handleVideoRecorded = async (video: VideoFile) => {
    if (!projectId || !section) return;

    try {
      // Fetch the latest project data
      const project = await getProjectById(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Update the project with the new video path
      // Check if this is the first recorded section for this project
      const isFirstSectionRecorded = Object.keys(project.recordedVideos).length === 0;

      const updatedProject = {
        ...project,
        recordedVideos: {
          ...project.recordedVideos,
          [section.name]: {
            path: video.path,
            orientation: orientation,
          },
        },
        updatedAt: new Date().toISOString(),
      };

      // Use the video path as the thumbnail URI
      if (isFirstSectionRecorded) {
        updatedProject.thumbnailUri = video.path;
      }

      // Save the updated project
      await saveProject(updatedProject);

      const sections = project.templateContent?.sections;
      if (!sections || sections.length === 0) {
        console.error("Could not determine sections for navigation logic.");
        router.replace({ pathname: '/(app)/template/[id]', params: { id: project.templateName, projectId: project.id } });
        return;
      }

      const currentSectionIndex = sections.findIndex((s: Section) => s.name === section.name);

      if (currentSectionIndex === -1) {
        console.error("Could not find current section index in project sections.");
        router.replace({ pathname: '/(app)/template/[id]', params: { id: project.templateName, projectId: project.id } });
        return;
      }

      const isLastSection = currentSectionIndex === sections.length - 1;

      if (isLastSection) {
        router.replace({ pathname: '/(app)/template/[id]', params: { id: project.templateName, projectId: project.id } });
      } else {
        router.push({
          pathname: '/(fullscreen)/preview',
          params: {
            projectId: projectId,
            videoUri: video.path,
            orientation: orientation,
            sectionName: section.name,
          },
        });
      }

    } catch (error) {
      console.error('Error saving recorded video:', error);
      Alert.alert('Error', 'Failed to save recorded video. Please try again.');
    }
  };

  return (
    <View style={styles.fullscreenContainer}>
      <StatusBar hidden={true} />

      {/* Header Bar */}
      <View style={styles.headerBar}>
        {/* Back Button */}
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
          disabled={isRecording} // Disable back button while recording
        >
          <Ionicons name="arrow-back" size={24} color={isRecording ? "rgba(255,255,255,0.5)" : "white"} />
          <Text style={[styles.headerButtonText, isRecording && { color: "rgba(255,255,255,0.5)" }]}>Back</Text>
        </TouchableOpacity>

        {/* Title */}
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
            {section.title?.en || section.name}
          </Text>
        </View>

        {/* Timer */}
        {isRecording && (
          <View style={styles.timerContainer}>
            <Text style={styles.timerText}>{formatTime(recordingDuration)}</Text>
            <View style={styles.recordingIndicator} />
          </View>
        )}
      </View>

      <VideoRecorder
        orientation={orientation}
        onVideoRecorded={handleVideoRecorded}
        existingVideoUri={existingVideoPath}
        sectionDescription={section.description?.en}
        fullscreen={true}
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
    height: 60 + (StatusBar.currentHeight || 0),
    paddingTop: StatusBar.currentHeight || 0,
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
  // Timer styles
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
