import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  ActivityIndicator,
  StatusBar,
  Animated,
  Easing,
} from 'react-native';
import { Camera, useCameraDevice, type VideoFile } from 'react-native-vision-camera';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/src/styles/theme';

interface VideoRecorderProps {
  orientation: 'portrait' | 'landscape';
  onVideoRecorded: (videoFile: VideoFile, orientation: 'portrait' | 'landscape') => void;
  existingVideoUri?: string;
  sectionDescription?: string;
  fullscreen?: boolean;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function getPreviewDimensions(orientation: 'portrait' | 'landscape', fullscreen: boolean) {
  const windowWidth = Dimensions.get('window').width;
  const windowHeight = Dimensions.get('window').height;

  if (fullscreen) {
    return { width: windowWidth, height: windowHeight };
  }

  if (orientation === 'portrait') {
    return { width: windowWidth * 0.95, height: windowWidth * 0.95 * (16 / 9) };
  }

  return { width: windowWidth * 0.95, height: windowWidth * 0.95 * (9 / 16) };
}

interface TimerOverlayProps {
  isPortrait: boolean;
  recordingDuration: number;
}
function TimerOverlay({ isPortrait, recordingDuration }: TimerOverlayProps) {
  return (
    <View style={[styles.timer, isPortrait ? styles.portraitTimer : styles.landscapeTimer]}>
      <Text style={styles.timerText}>{formatTime(recordingDuration)}</Text>
      <View style={styles.recordingIndicator} />
    </View>
  );
}

interface FlipButtonProps {
  isPortrait: boolean;
  isRecording: boolean;
  onPress: () => void;
}
function FlipButton({ isPortrait, isRecording, onPress }: FlipButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.flipCameraButton, isPortrait ? styles.portraitFlipButton : styles.landscapeFlipButton]}
      onPress={onPress}
      disabled={isRecording}
    >
      <Ionicons name="camera-reverse-outline" size={24} color={isRecording ? 'rgba(255,255,255,0.5)' : 'white'} />
    </TouchableOpacity>
  );
}

interface DescriptionOverlayProps {
  isPortrait: boolean;
  description: string;
  onDismiss: () => void;
}
function DescriptionOverlay({ isPortrait, description, onDismiss }: DescriptionOverlayProps) {
  return (
    <TouchableOpacity
      style={[
        styles.descriptionOverlay,
        isPortrait ? styles.portraitDescriptionOverlay : styles.landscapeDescriptionOverlay,
      ]}
      onPress={onDismiss}
    >
      <Text style={styles.descriptionOverlayText}>{description}</Text>
    </TouchableOpacity>
  );
}

function useCameraPermissions() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);

  useEffect(() => {
    const checkPermissions = async () => {
      setIsCheckingPermissions(true);

      try {
        const cameraPermission = await Camera.requestCameraPermission();
        const micPermission = await Camera.requestMicrophonePermission();
        setHasPermission(cameraPermission === 'granted' && micPermission === 'granted');
      } catch (error) {
        console.error('Error checking permissions:', error);
        setHasPermission(false);
      } finally {
        setIsCheckingPermissions(false);
      }
    };

    checkPermissions().catch((error: unknown) => {
      console.error('checkPermissions failed:', error);
    });
  }, []);

  return { hasPermission, isCheckingPermissions };
}

function useRecordingTimer(isRecording: boolean): number {
  const [recordingDuration, setRecordingDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecordingDuration(0);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  return recordingDuration;
}

function usePulseAnimation(isRecording: boolean): Animated.Value {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 500, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, easing: Easing.linear, useNativeDriver: true }),
        ])
      ).start();

      return;
    }
    pulseAnim.setValue(1);
    pulseAnim.stopAnimation();
  }, [isRecording, pulseAnim]);

  return pulseAnim;
}

interface RecordingActionsParams {
  cameraRef: React.RefObject<Camera | null>;
  setIsRecording: (v: boolean) => void;
  onVideoRecorded: (videoFile: VideoFile, orientation: 'portrait' | 'landscape') => void;
  orientation: 'portrait' | 'landscape';
  device: ReturnType<typeof useCameraDevice>;
}

function useRecordingActions({
  cameraRef,
  setIsRecording,
  onVideoRecorded,
  orientation,
  device,
}: RecordingActionsParams) {
  const startRecording = async () => {
    if (!cameraRef.current || !device) {
      console.warn('Attempted to start recording when camera not ready.');

      return;
    }

    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
      setIsRecording(true);
      cameraRef.current.startRecording({
        fileType: 'mp4',
        videoCodec: 'h264',
        ...(Platform.OS === 'android' ? { outputFormat: 'mp4' } : { codec: 'avc1' }),
        onRecordingFinished: (video) => {
          onVideoRecorded(video, orientation);
          setIsRecording(false);
        },
        onRecordingError: (error) => {
          console.error('Recording error:', error);
          setIsRecording(false);
        },
      });
    } catch (error) {
      console.error('Failed to start recording:', error);
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    if (!cameraRef.current) return;

    try {
      await cameraRef.current.stopRecording();
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setIsRecording(false);
    }
  };

  const handleRecordPress = (isRecording: boolean) => {
    if (isRecording) {
      stopRecording().catch((error: unknown) => {
        console.error('stopRecording failed:', error);
      });

      return;
    }
    startRecording().catch((error: unknown) => {
      console.error('startRecording failed:', error);
    });
  };

  return { handleRecordPress };
}

const VideoRecorder: React.FC<VideoRecorderProps> = ({
  orientation,
  onVideoRecorded,
  sectionDescription,
  fullscreen = false,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [showDescription, setShowDescription] = useState(true);
  const [cameraType, setCameraType] = useState<'front' | 'back'>('back');
  const cameraRef = useRef<Camera | null>(null);
  const device = useCameraDevice(cameraType);
  const { hasPermission, isCheckingPermissions } = useCameraPermissions();
  const recordingDuration = useRecordingTimer(isRecording);
  const pulseAnim = usePulseAnimation(isRecording);
  const isPortrait = orientation === 'portrait';
  const dimensions = getPreviewDimensions(orientation, fullscreen);
  const { handleRecordPress } = useRecordingActions({
    cameraRef,
    setIsRecording,
    onVideoRecorded,
    orientation,
    device,
  });
  const toggleCameraType = () => {
    setCameraType((current) => (current === 'back' ? 'front' : 'back'));
  };

  if (isCheckingPermissions) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.permissionText}>Checking camera permissions...</Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={48} color={colors.error} />
        <Text style={styles.permissionTitle}>Camera Permission Required</Text>
        <Text style={styles.permissionText}>Please grant camera and microphone permissions to record video.</Text>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={[styles.container, { width: dimensions.width, height: dimensions.height }]}>
        <Text style={styles.errorText}>No camera device available</Text>
      </View>
    );
  }

  return (
    <View style={fullscreen ? styles.fullscreenContainer : styles.container}>
      <StatusBar hidden backgroundColor="transparent" translucent />
      <Camera ref={cameraRef} style={styles.camera} device={device} isActive video audio />
      {isRecording && <TimerOverlay isPortrait={isPortrait} recordingDuration={recordingDuration} />}
      <View style={[styles.controls, isPortrait ? styles.portraitControls : styles.landscapeControls]}>
        <TouchableOpacity
          style={[styles.recordButton, isRecording && styles.stopButton]}
          onPress={() => {
            handleRecordPress(isRecording);
          }}
        >
          <Animated.View style={[styles.recordIcon, { transform: [{ scale: pulseAnim }] }]} />
        </TouchableOpacity>
      </View>
      <FlipButton isPortrait={isPortrait} isRecording={isRecording} onPress={toggleCameraType} />
      {sectionDescription && showDescription && (
        <DescriptionOverlay
          isPortrait={isPortrait}
          description={sectionDescription}
          onDismiss={() => {
            setShowDescription(false);
          }}
        />
      )}
      <Text style={[styles.instructionText, isPortrait ? styles.portraitInstructions : styles.landscapeInstructions]}>
        {orientation === 'portrait'
          ? 'Hold your device vertically for best results'
          : 'Hold your device horizontally for best results'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', position: 'relative' },
  fullscreenContainer: { flex: 1, backgroundColor: '#000', position: 'relative' },
  camera: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 },
  timer: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    zIndex: 50,
  },
  portraitTimer: { top: 100, alignSelf: 'center' },
  landscapeTimer: { top: 50, right: 30 },
  timerText: { color: 'white', fontSize: 16, marginRight: spacing.s },
  recordingIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.error },
  controls: { position: 'absolute', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', zIndex: 5 },
  portraitControls: { bottom: 50, left: 0, right: 0 },
  landscapeControls: { bottom: 0, top: 0, right: 50, justifyContent: 'center' },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  stopButton: { backgroundColor: 'rgba(255, 100, 100, 0.3)', borderColor: colors.error },
  recordIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.error },
  stopIcon: { width: 32, height: 32, backgroundColor: colors.error, borderRadius: 4 },
  flipCameraButton: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },
  portraitFlipButton: { bottom: 50, right: 50 },
  landscapeFlipButton: { bottom: 50, left: 50 },
  descriptionOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    padding: spacing.m,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },
  portraitDescriptionOverlay: { top: 120, left: 20, right: 20 },
  landscapeDescriptionOverlay: { top: 80, left: 100, maxWidth: '50%' },
  descriptionOverlayText: { ...typography.body, color: 'white', textAlign: 'center', fontSize: 16, fontWeight: '500' },
  instructionText: {
    ...typography.caption,
    textAlign: 'center',
    position: 'absolute',
    color: 'white',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: spacing.s,
    borderRadius: 8,
    zIndex: 4,
    fontSize: 14,
  },
  portraitInstructions: { bottom: 150, left: 20, right: 20 },
  landscapeInstructions: { bottom: 20, left: 100, right: 100 },
  errorText: { ...typography.body, color: colors.error, textAlign: 'center' },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginVertical: spacing.m,
  },
  permissionTitle: { ...typography.subtitle, color: colors.error, marginVertical: spacing.m },
  permissionText: { ...typography.body, textAlign: 'center', marginTop: spacing.m },
});

export default VideoRecorder;
