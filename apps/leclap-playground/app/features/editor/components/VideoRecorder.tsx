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
  Easing
} from 'react-native';
import { 
  Camera,
  useCameraDevice,
  VideoFile
} from 'react-native-vision-camera';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/app/styles/theme';

interface VideoRecorderProps {
  orientation: 'portrait' | 'landscape';
  onVideoRecorded: (videoFile: VideoFile, orientation: 'portrait' | 'landscape') => void;
  existingVideoUri?: string;
  sectionDescription?: string;
  fullscreen?: boolean;
  // Removed recordingDuration, isRecording, and setIsRecording props
}

const VideoRecorder: React.FC<VideoRecorderProps> = ({
  orientation,
  onVideoRecorded,
  sectionDescription,
  fullscreen = false,
  // Removed recordingDuration, isRecording, and setIsRecording from destructuring
}) => {
  const [isRecording, setIsRecording] = useState(false); // Local state for recording status
  const [recordingDuration, setRecordingDuration] = useState(0); // Local state for recording duration
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);
  const [cameraType, setCameraType] = useState<'front' | 'back'>('back');
  const [showDescription, setShowDescription] = useState(true);

  const cameraRef = useRef<Camera>(null);
  const device = useCameraDevice(cameraType);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const isPortrait = orientation === 'portrait';

  // Pulsing animation for record button
  useEffect(() => {
    if (!isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 500,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1); // Reset animation when recording starts
      pulseAnim.stopAnimation();
    }
  }, [isRecording, pulseAnim]);

  const toggleCameraType = () => {
    setCameraType(current => current === 'back' ? 'front' : 'back');
  };

  useEffect(() => {
    const checkPermissions = async () => {
      setIsCheckingPermissions(true);
      try {
        const cameraPermission = await Camera.requestCameraPermission();
        const micPermission = await Camera.requestMicrophonePermission();
        setHasPermission(
          cameraPermission === 'granted' && 
          micPermission === 'granted'
        );
      } catch (error) {
        console.error('Error checking permissions:', error);
        setHasPermission(false);
      } finally {
        setIsCheckingPermissions(false);
      }
    };

    checkPermissions();
  }, []);

  // Timer logic - Reinstated
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
  }, [isRecording]);

  const getPreviewDimensions = () => {
    const windowWidth = Dimensions.get('window').width;
    const windowHeight = Dimensions.get('window').height;
    
    if (fullscreen) {
      return {
        width: windowWidth,
        height: windowHeight,
      };
    }
    
    if (orientation === 'portrait') {
      return {
        width: windowWidth * 0.95,
        height: (windowWidth * 0.95) * (16/9),
      };
    } else {
      return {
        width: windowWidth * 0.95,
        height: (windowWidth * 0.95) * (9/16),
      };
    }
  };
  
  const dimensions = getPreviewDimensions();

  const startRecording = async () => {
    if (!cameraRef.current || isRecording || !device) {
      console.warn('Attempted to start recording when camera not ready or already recording.');
      return;
    }
    
    try {
      // Increase delay to ensure camera is ready
      await new Promise(resolve => setTimeout(resolve, 500)); 

      setIsRecording(true);
      
      cameraRef.current.startRecording({
        fileType: 'mp4',
        videoCodec: 'h264',
        ...(Platform.OS === 'android' ? {
          outputFormat: 'mp4',
        } : {
          codec: 'avc1',
        }),
        onRecordingFinished: (video) => {
          onVideoRecorded(video, orientation);
          setIsRecording(false);
        },
        onRecordingError: (error) => {
          console.error('Recording error:', error);
          setIsRecording(false);
        },
      });
    } catch (e) {
      console.error('Failed to start recording:', e);
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    if (!cameraRef.current || !isRecording) return;
    try {
      await cameraRef.current.stopRecording();
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setIsRecording(false); // Ensure recording state is false on error
    }
  };

  // formatTime is now used in this component again
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
        <Text style={styles.permissionText}>
          Please grant camera and microphone permissions to record video.
        </Text>
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

  // Render UI based on fullscreen prop and orientation
  return (
    <View style={fullscreen ? styles.fullscreenContainer : styles.container}>
      <StatusBar hidden={true} backgroundColor="transparent" translucent />
      
      <Camera
        ref={cameraRef}
        style={styles.camera}
        device={device}
        isActive={true}
        video={true}
        audio={true}
      />
      
      {/* Timer - Rendered locally again */}
      {isRecording && (
        <View style={[
          styles.timer,
          isPortrait ? styles.portraitTimer : styles.landscapeTimer
        ]}>
          <Text style={styles.timerText}>{formatTime(recordingDuration)}</Text>
          <View style={styles.recordingIndicator} />
        </View>
      )}
      
      {/* Record button */}
      <View style={[
        styles.controls,
        isPortrait ? styles.portraitControls : styles.landscapeControls
      ]}>
        <TouchableOpacity
          style={[styles.recordButton, isRecording && styles.stopButton]}
          onPress={isRecording ? stopRecording : startRecording}
          disabled={!hasPermission || !device} // Disable if no permissions or device
        >
          <Animated.View style={[styles.recordIcon, { transform: [{ scale: pulseAnim }] }]} />
        </TouchableOpacity>
      </View>
      
      {/* Camera flip button */}
      <TouchableOpacity 
        style={[
          styles.flipCameraButton,
          isPortrait ? styles.portraitFlipButton : styles.landscapeFlipButton
        ]}
        onPress={toggleCameraType}
        disabled={isRecording || !hasPermission || !device} // Disable while recording or no permissions/device
      >
        <Ionicons 
          name="camera-reverse-outline" 
          size={24} 
          color={isRecording || !hasPermission || !device ? "rgba(255,255,255,0.5)" : "white"} 
        />
      </TouchableOpacity>

      {/* Section Description */}
      {sectionDescription && showDescription && (
        <TouchableOpacity 
          style={[
            styles.descriptionOverlay,
            isPortrait ? styles.portraitDescriptionOverlay : styles.landscapeDescriptionOverlay
          ]}
          onPress={() => setShowDescription(false)} // Hide on tap
        >
          <Text style={styles.descriptionOverlayText}>{sectionDescription}</Text>
        </TouchableOpacity>
      )}

      {/* Instruction text */}
      <Text style={[
        styles.instructionText, 
        isPortrait ? styles.portraitInstructions : styles.landscapeInstructions
      ]}>
        {orientation === 'portrait'
          ? 'Hold your device vertically for best results'
          : 'Hold your device horizontally for best results'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  camera: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
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
  portraitTimer: {
    top: 100,
    alignSelf: 'center',
  },
  landscapeTimer: {
    top: 50,
    right: 30,
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
  // Controls (Record Button Container)
  controls: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  portraitControls: {
    bottom: 50,
    left: 0,
    right: 0,
  },
  landscapeControls: {
    bottom: 0,
    top: 0,
    right: 50,
    justifyContent: 'center',
  },
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
  stopButton: {
    backgroundColor: 'rgba(255, 100, 100, 0.3)',
    borderColor: colors.error,
  },
  recordIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.error,
  },
  stopIcon: {
    width: 32,
    height: 32,
    backgroundColor: colors.error,
    borderRadius: 4,
  },
  // Camera Flip Button
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
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  portraitFlipButton: {
    bottom: 50,
    right: 50,
  },
  landscapeFlipButton: {
    bottom: 50,
    left: 50,
  },
  // Section Description Overlay
  descriptionOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    padding: spacing.m,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  portraitDescriptionOverlay: {
    top: 120, // Positioned below timer
    left: 20,
    right: 20,
  },
  landscapeDescriptionOverlay: {
    top: 80, // Positioned below timer
    left: 100,
    maxWidth: '50%',
  },
  descriptionOverlayText: {
    ...typography.body,
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500',
  },
  // Instruction Text
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
  portraitInstructions: {
    bottom: 150,
    left: 20,
    right: 20,
  },
  landscapeInstructions: {
    bottom: 20,
    left: 100,
    right: 100,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    textAlign: 'center',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginVertical: spacing.m,
  },
  permissionTitle: {
    ...typography.subtitle,
    color: colors.error,
    marginVertical: spacing.m,
  },
  permissionText: {
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.m,
  },
});

export default VideoRecorder;
