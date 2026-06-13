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
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { colors, spacing, typography } from '@/src/styles/theme';
import { FramingGuideOverlay } from './FramingGuideOverlay';
import type { FramingGuide } from '@/src/types';

interface VideoRecorderProps {
  orientation: 'portrait' | 'landscape';
  onVideoRecorded: (videoFile: VideoFile, orientation: 'portrait' | 'landscape') => void;
  existingVideoUri?: string;
  sectionDescription?: string;
  fullscreen?: boolean;
  // When > 0, a 3·2·1 countdown plays before recording actually starts.
  countdownSeconds?: number;
  // The section's target duration; drives the "wrap up" warning shown in its last seconds.
  maxDurationSeconds?: number;
  // Camera framing guide overlay — shown during live preview/recording only, never burned into video.
  framingGuide?: FramingGuide;
}

// How many seconds before the target duration the end-of-recording warning kicks in.
const END_WARNING_THRESHOLD = 3;

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function getInstructionText(orientation: 'portrait' | 'landscape', t: TFunction<'recording'>): string {
  return orientation === 'portrait' ? t('instructions.portrait') : t('instructions.landscape');
}

function getNextCameraType(current: 'front' | 'back'): 'front' | 'back' {
  return current === 'back' ? 'front' : 'back';
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

// Big centered "3 · 2 · 1" shown over the camera before recording starts. Each
// number springs in (scale 1.4 → 1, fade) so the tick reads as a distinct beat.
function CountdownOverlay({ value, t }: { value: number; t: TFunction<'recording'> }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    scale.setValue(1.4);
    opacity.setValue(0.4);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [value, scale, opacity]);

  return (
    <View
      style={styles.countdownOverlay}
      pointerEvents="none"
      accessibilityLabel={t('countdown.accessibility', { value })}
    >
      <Animated.Text style={[styles.countdownText, { opacity, transform: [{ scale }] }]}>{value}</Animated.Text>
      <Text style={styles.countdownHint}>{t('countdown.getReady')}</Text>
    </View>
  );
}

// Pulsing red border + "wrap up" badge shown during the last seconds of the target duration.
function EndWarningOverlay({
  remaining,
  pulse,
  t,
}: {
  remaining: number;
  pulse: Animated.Value;
  t: TFunction<'recording'>;
}) {
  return (
    <Animated.View style={[styles.endWarningBorder, { opacity: pulse }]} pointerEvents="none">
      <View style={styles.endWarningBadge}>
        <Ionicons name="timer-outline" size={16} color="white" />
        <Text style={styles.endWarningText}>
          {remaining > 0 ? t('endWarning.wrapUp', { remaining }) : t('endWarning.timesUp')}
        </Text>
      </View>
    </Animated.View>
  );
}

// Renders the framing guide over the live camera, including WHILE recording — its whole
// purpose is helping the user hold their framing during the take (matches web behavior).
// Dedicated component keeps the complexity budget of the VideoRecorder function intact.
function FramingGuideOverlayWhenLive({ guide }: { guide: FramingGuide | undefined }) {
  if (!guide) return null;

  return <FramingGuideOverlay guide={guide} />;
}

interface CountdownState {
  value: number | null;
  isCounting: boolean;
  start: (seconds: number) => void;
  cancel: () => void;
}

interface CaptureOverlaysProps {
  isPortrait: boolean;
  isRecording: boolean;
  recordingDuration: number;
  showEndWarning: boolean;
  remaining: number;
  warningPulse: Animated.Value;
  countdown: CountdownState;
  t: TFunction<'recording'>;
}

// All camera overlays in one place: the elapsed timer, the end-of-duration warning,
// and the pre-record countdown. Grouped so the main component stays simple.
function CaptureOverlays({
  isPortrait,
  isRecording,
  recordingDuration,
  showEndWarning,
  remaining,
  warningPulse,
  countdown,
  t,
}: CaptureOverlaysProps) {
  return (
    <>
      {isRecording && <TimerOverlay isPortrait={isPortrait} recordingDuration={recordingDuration} />}
      {showEndWarning && <EndWarningOverlay remaining={remaining} pulse={warningPulse} t={t} />}
      {countdown.isCounting && countdown.value !== null && <CountdownOverlay value={countdown.value} t={t} />}
    </>
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

// Drives the pre-record 3·2·1 countdown. `start(n)` shows n, n-1 … 1 (one per
// second) then fires `onComplete`; `cancel()` aborts it.
function useCountdown(onComplete: () => void) {
  const [value, setValue] = useState<number | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (value === null) {
      return () => {};
    }

    if (value <= 0) {
      setValue(null);
      onCompleteRef.current();

      return () => {};
    }

    const id = setTimeout(() => {
      setValue((v) => (v === null ? null : v - 1));
    }, 1000);

    return () => {
      clearTimeout(id);
    };
  }, [value]);

  return {
    value,
    isCounting: value !== null,
    start: (seconds: number) => {
      setValue(seconds);
    },
    cancel: () => {
      setValue(null);
    },
  };
}

// Loops a 1 ⇄ 0.25 opacity pulse while `active`, used for the end-of-duration warning border.
function useWarningPulse(active: boolean): Animated.Value {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (active) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 0.25, duration: 450, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 450, easing: Easing.linear, useNativeDriver: true }),
        ])
      );
      loop.start();

      return () => {
        loop.stop();
      };
    }

    pulse.stopAnimation();
    pulse.setValue(1);

    return () => {};
  }, [active, pulse]);

  return pulse;
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
  // Synchronous re-entrancy guard. `isRecording` state updates asynchronously and the start path
  // awaits a 500 ms settle delay, so a double-tap in that window would call the native
  // startRecording() twice ("already an active video recording in progress"). This ref flips the
  // instant a start begins and clears on finish/error/stop — blocking the second call right away.
  const isBusyRef = useRef(false);
  // Mirror guard for the stop path: `isRecording` also flips asynchronously, so a double-tap on the
  // stop button calls the native stopRecording() twice ("no active video recording in progress").
  // This ref blocks the second call until the recording actually finishes/errors and clears it.
  const isStoppingRef = useRef(false);

  const startRecording = async () => {
    if (!cameraRef.current || !device) {
      console.warn('Attempted to start recording when camera not ready.');

      return;
    }

    if (isBusyRef.current) {
      return;
    }
    isBusyRef.current = true;

    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
      setIsRecording(true);
      cameraRef.current.startRecording({
        fileType: 'mp4',
        videoCodec: 'h264',
        ...(Platform.OS === 'android' ? { outputFormat: 'mp4' } : { codec: 'avc1' }),
        onRecordingFinished: (video) => {
          isBusyRef.current = false;
          isStoppingRef.current = false;
          onVideoRecorded(video, orientation);
          setIsRecording(false);
        },
        onRecordingError: (error) => {
          isBusyRef.current = false;
          isStoppingRef.current = false;
          console.error('Recording error:', error);
          setIsRecording(false);
        },
      });
    } catch (error) {
      isBusyRef.current = false;
      console.error('Failed to start recording:', error);
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    if (!cameraRef.current) return;

    if (isStoppingRef.current) {
      return;
    }
    isStoppingRef.current = true;

    try {
      await cameraRef.current.stopRecording();
    } catch (error) {
      isBusyRef.current = false;
      isStoppingRef.current = false;
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

interface CaptureControlsParams {
  isRecording: boolean;
  recordingDuration: number;
  handleRecordPress: (isRecording: boolean) => void;
  countdownSeconds?: number;
  maxDurationSeconds?: number;
}

// Owns the pre-record countdown + end-of-duration warning state and the single
// record-button handler (start / cancel-countdown / stop), keeping the component lean.
// End-of-duration warning state: active only while recording and within the last
// few seconds of the target duration. `remaining` counts down to 0.
function computeEndWarning(
  isRecording: boolean,
  recordingDuration: number,
  maxDurationSeconds: number | undefined
): { showEndWarning: boolean; remaining: number } {
  if (isRecording && maxDurationSeconds !== undefined && maxDurationSeconds > 0) {
    return {
      showEndWarning: recordingDuration >= maxDurationSeconds - END_WARNING_THRESHOLD,
      remaining: Math.max(0, maxDurationSeconds - recordingDuration),
    };
  }

  return { showEndWarning: false, remaining: 0 };
}

function useCaptureControls({
  isRecording,
  recordingDuration,
  handleRecordPress,
  countdownSeconds,
  maxDurationSeconds,
}: CaptureControlsParams) {
  const countdown = useCountdown(() => {
    handleRecordPress(false);
  });
  const hasCountdown = countdownSeconds !== undefined && countdownSeconds > 0;
  const { showEndWarning, remaining } = computeEndWarning(isRecording, recordingDuration, maxDurationSeconds);
  const warningPulse = useWarningPulse(showEndWarning);

  const onRecordButtonPress = () => {
    if (isRecording) {
      handleRecordPress(true);

      return;
    }

    if (countdown.isCounting) {
      countdown.cancel();

      return;
    }

    if (hasCountdown) {
      countdown.start(countdownSeconds);

      return;
    }

    handleRecordPress(false);
  };

  return { countdown, warningPulse, showEndWarning, remaining, onRecordButtonPress };
}

const VideoRecorder: React.FC<VideoRecorderProps> = ({
  orientation,
  onVideoRecorded,
  sectionDescription,
  fullscreen = false,
  countdownSeconds,
  maxDurationSeconds,
  framingGuide,
}) => {
  const { t } = useTranslation('recording');
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
  const { countdown, warningPulse, showEndWarning, remaining, onRecordButtonPress } = useCaptureControls({
    isRecording,
    recordingDuration,
    handleRecordPress,
    countdownSeconds,
    maxDurationSeconds,
  });

  if (isCheckingPermissions) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.permissionText}>{t('permissions.checking')}</Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={48} color={colors.error} />
        <Text style={styles.permissionTitle}>{t('permissions.title')}</Text>
        <Text style={styles.permissionText}>{t('permissions.message')}</Text>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={[styles.container, { width: dimensions.width, height: dimensions.height }]}>
        <Text style={styles.errorText}>{t('noDevice')}</Text>
      </View>
    );
  }

  return (
    <View style={fullscreen ? styles.fullscreenContainer : styles.container}>
      <StatusBar hidden backgroundColor="transparent" translucent />
      <Camera ref={cameraRef} style={styles.camera} device={device} isActive video audio />
      <FramingGuideOverlayWhenLive guide={framingGuide} />
      <CaptureOverlays
        isPortrait={isPortrait}
        isRecording={isRecording}
        recordingDuration={recordingDuration}
        showEndWarning={showEndWarning}
        remaining={remaining}
        warningPulse={warningPulse}
        countdown={countdown}
        t={t}
      />
      <View style={[styles.controls, isPortrait ? styles.portraitControls : styles.landscapeControls]}>
        <TouchableOpacity style={[styles.recordButton, isRecording && styles.stopButton]} onPress={onRecordButtonPress}>
          <Animated.View style={[styles.recordIcon, { transform: [{ scale: pulseAnim }] }]} />
        </TouchableOpacity>
      </View>
      <FlipButton
        isPortrait={isPortrait}
        isRecording={isRecording}
        onPress={() => {
          setCameraType(getNextCameraType);
        }}
      />
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
        {getInstructionText(orientation, t)}
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
  countdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    zIndex: 60,
  },
  countdownText: {
    color: 'white',
    fontSize: 140,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 16,
  },
  countdownHint: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 18,
    fontWeight: '600',
    marginTop: spacing.s,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  endWarningBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 6,
    borderColor: colors.error,
    alignItems: 'center',
    zIndex: 55,
  },
  endWarningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xxl,
    backgroundColor: colors.error,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
    borderRadius: 16,
  },
  endWarningText: { color: 'white', fontSize: 15, fontWeight: '700' },
  timerText: { color: 'white', fontSize: 16, marginRight: spacing.s, fontVariant: ['tabular-nums'] },
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
