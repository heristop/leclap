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
import { Camera, useCameraDevice, type VideoFile, type CameraDevice } from 'react-native-vision-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, typography } from '@/src/styles/theme';
import { FramingGuideOverlay } from './FramingGuideOverlay';
import type { FramingGuide, Orientation } from '@/src/types';
import { ASPECT_RATIO } from '@/src/features/templates/orientationMeta';
import type { CaptureMode } from '@leclap/creative-kit';

interface VideoRecorderProps {
  orientation: Orientation;
  onVideoRecorded: (videoFile: VideoFile, orientation: Orientation) => void;
  existingVideoUri?: string;
  sectionDescription?: string;
  fullscreen?: boolean;
  // When > 0, a 3·2·1 countdown plays before recording actually starts.
  countdownSeconds?: number;
  // The section's target duration; drives the "wrap up" warning shown in its last seconds.
  maxDurationSeconds?: number;
  // Camera framing guide overlay — shown during live preview/recording only, never burned into video.
  framingGuide?: FramingGuide;
  // Fired when the post-stop "finalizing" freeze begins/ends so the host can disable its own chrome
  // (e.g. the Back button), which lives outside this component's stacking context.
  onFinalizingChange?: (finalizing: boolean) => void;
  // Ordered list of modes the user can switch to. 'screen' is silently filtered at the call site.
  allowedModes?: CaptureMode[];
}

// How many seconds before the target duration the end-of-recording warning kicks in.
const END_WARNING_THRESHOLD = 3;

const DEFAULT_MODES: CaptureMode[] = ['front', 'back'];

// Scrim gradients (brand near-black) that keep the header/description/controls legible over the live
// camera. `as const` so the colors satisfy LinearGradient's readonly-tuple prop type.
const TOP_SCRIM_COLORS = ['rgba(11,11,15,0.65)', 'rgba(11,11,15,0)'] as const;
const BOTTOM_SCRIM_COLORS = ['rgba(11,11,15,0)', 'rgba(11,11,15,0.7)'] as const;

const MODE_LABELS: Record<CaptureMode, string> = {
  front: 'Front',
  back: 'Back',
  upload: 'Upload',
  screen: 'Screen',
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function getInstructionText(orientation: Orientation, t: TFunction<'recording'>): string {
  if (orientation === 'landscape') return t('instructions.landscape');

  if (orientation === 'square') return t('instructions.square');

  return t('instructions.portrait');
}

function getNextCameraType(current: 'front' | 'back'): 'front' | 'back' {
  return current === 'back' ? 'front' : 'back';
}

function getPreviewDimensions(orientation: Orientation, fullscreen: boolean) {
  const windowWidth = Dimensions.get('window').width;
  const windowHeight = Dimensions.get('window').height;

  if (fullscreen) {
    return { width: windowWidth, height: windowHeight };
  }

  // height = width / (w/h) — square stays 1:1, portrait grows tall, landscape stays wide.
  const width = windowWidth * 0.95;

  return { width, height: width / ASPECT_RATIO[orientation] };
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

// Renders the finalizing blocker (high-zIndex overlay + spinner) while the clip is being
// saved. Pulled out so it doesn't add to VideoRecorder's cyclomatic-complexity budget.
function FinalizingOverlay({ visible, t }: { visible: boolean; t: TFunction<'recording'> }) {
  if (!visible) return null;

  return (
    <View style={styles.finalizingOverlay}>
      <ActivityIndicator size="large" color="white" />
      <Text style={styles.finalizingText}>{t('processing')}</Text>
    </View>
  );
}

// Renders either the mode-switch pill bar (when multiple modes are allowed) or the legacy
// flip-camera button (single-mode / no bar). Extracted to keep VideoRecorder lean.
interface ModeBarOrFlipProps {
  showModeBar: boolean;
  allowedModes: CaptureMode[];
  activeMode: CaptureMode;
  onModeChange: (m: CaptureMode) => void;
  isPortrait: boolean;
  isBusy: boolean;
  onFlip: () => void;
}
function ModeBarOrFlip({
  showModeBar,
  allowedModes,
  activeMode,
  onModeChange,
  isPortrait,
  isBusy,
  onFlip,
}: ModeBarOrFlipProps) {
  if (showModeBar) {
    // Hide the mode toggle entirely while recording/finalizing — switching cameras mid-take isn't
    // possible, and it keeps the frame clean around the record button.
    if (isBusy) return null;

    return <RNCaptureModeBar modes={allowedModes} active={activeMode} onChange={onModeChange} disabled={false} />;
  }

  return <FlipButton isPortrait={isPortrait} isRecording={isBusy} onPress={onFlip} />;
}

// Renders the <Camera> element — a simple pass-through wrapper for square orientation that
// constrains the live view to a 1:1 frame without burning that ternary into VideoRecorder.
function CameraBody({
  cameraRef,
  device,
  orientation,
}: {
  cameraRef: React.RefObject<Camera | null>;
  device: CameraDevice;
  orientation: Orientation;
}) {
  if (orientation !== 'square') {
    return <Camera ref={cameraRef} style={styles.camera} device={device} isActive video audio />;
  }

  const size = Dimensions.get('window').width;

  return (
    <View style={styles.squareFrameWrap}>
      <View style={[styles.squareFrame, { width: size, height: size }]}>
        <Camera ref={cameraRef} style={styles.camera} device={device} isActive video audio resizeMode="cover" />
      </View>
    </View>
  );
}

// Renders the framing guide over the live camera, including WHILE recording — its whole
// purpose is helping the user hold their framing during the take (matches web behavior).
// Dedicated component keeps the complexity budget of the VideoRecorder function intact.
function FramingGuideOverlayWhenLive({
  guide,
  orientation,
}: {
  guide: FramingGuide | undefined;
  orientation: Orientation;
}) {
  if (!guide) return null;

  return <FramingGuideOverlay guide={guide} orientation={orientation} />;
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

interface RNCaptureModeBarProps {
  modes: CaptureMode[];
  active: CaptureMode;
  onChange: (m: CaptureMode) => void;
  disabled: boolean;
}

function RNCaptureModeBar({ modes, active, onChange, disabled }: RNCaptureModeBarProps) {
  return (
    <View style={styles.captureModeBar} pointerEvents={disabled ? 'none' : 'auto'}>
      {/* One translucent track holding equal-width segments — the active segment is the only filled
          one, so it reads as a single segmented control rather than two floating pills. */}
      <View style={styles.captureModeTrack}>
        {modes.map((mode) => {
          const isActive = active === mode;

          return (
            <TouchableOpacity
              key={mode}
              style={[styles.captureModeSegment, isActive && styles.captureModeSegmentActive]}
              onPress={() => {
                onChange(mode);
              }}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={MODE_LABELS[mode]}
            >
              <Text style={[styles.captureModeSegmentText, isActive && styles.captureModeSegmentTextActive]}>
                {MODE_LABELS[mode]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

interface UploadPlaceholderProps {
  onPick: () => Promise<void>;
}

function UploadPlaceholder({ onPick }: UploadPlaceholderProps) {
  const handlePress = () => {
    onPick().catch((error: unknown) => {
      console.error('pickVideo failed:', error);
    });
  };

  return (
    <View style={styles.uploadPlaceholder}>
      <Ionicons name="cloud-upload-outline" size={64} color="rgba(255,255,255,0.7)" />
      <Text style={styles.uploadLabel}>Pick a video from your gallery</Text>
      <TouchableOpacity style={styles.uploadButton} onPress={handlePress}>
        <Text style={styles.uploadButtonText}>Choose Video</Text>
      </TouchableOpacity>
    </View>
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
      activeOpacity={0.9}
      style={[
        styles.descriptionOverlay,
        isPortrait ? styles.portraitDescriptionOverlay : styles.landscapeDescriptionOverlay,
      ]}
      onPress={onDismiss}
    >
      <Ionicons name="sparkles" size={16} color={colors.primary} style={styles.descriptionIcon} />
      <Text style={styles.descriptionOverlayText}>{description}</Text>
      <Ionicons name="close" size={16} color="rgba(255,255,255,0.6)" style={styles.descriptionClose} />
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
      // Complete straight from 1 — the countdown never displays 0.
      if (value <= 1) {
        setValue(null);
        onCompleteRef.current();

        return;
      }

      setValue(value - 1);
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

function useDescriptionOverlay() {
  const [showDescription, setShowDescription] = useState(true);

  return {
    showDescription,
    dismiss: () => {
      setShowDescription(false);
    },
  };
}

function useFinalizingSync(onChange: ((v: boolean) => void) | undefined) {
  const [isFinalizing, setIsFinalizingState] = useState(false);

  const setIsFinalizing = (v: boolean) => {
    setIsFinalizingState(v);
    onChange?.(v);
  };

  return { isFinalizing, setIsFinalizing };
}

interface UseCaptureModeParams {
  allowedModes: CaptureMode[];
  onVideoRecorded: (videoFile: VideoFile, orientation: Orientation) => void;
  orientation: Orientation;
}

function useCaptureMode({ allowedModes, onVideoRecorded, orientation }: UseCaptureModeParams) {
  const [activeMode, setActiveMode] = useState<CaptureMode>(allowedModes[0] ?? 'back');
  const [cameraType, setCameraType] = useState<'front' | 'back'>(activeMode === 'front' ? 'front' : 'back');

  const handleModeChange = (mode: CaptureMode) => {
    setActiveMode(mode);

    if (mode === 'front' || mode === 'back') {
      setCameraType(mode);
    }
  };

  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'videos',
      allowsEditing: false,
      quality: 1,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    onVideoRecorded({ path: asset.uri } as VideoFile, orientation);
  };

  return {
    activeMode,
    cameraType,
    handleModeChange,
    pickVideo,
    flipCamera: () => {
      setCameraType(getNextCameraType);
    },
    showModeBar: allowedModes.length > 1,
    isUploadMode: activeMode === 'upload',
  };
}

interface RecordingActionsParams {
  cameraRef: React.RefObject<Camera | null>;
  setIsRecording: (v: boolean) => void;
  // Toggled while the native engine finalizes the stopped recording (and the clip is saved/navigated).
  // Drives the blocking overlay so taps during that brief freeze can't start a new take or navigate.
  setIsFinalizing: (v: boolean) => void;
  onVideoRecorded: (videoFile: VideoFile, orientation: Orientation) => void;
  orientation: Orientation;
  device: ReturnType<typeof useCameraDevice>;
}

function useRecordingActions({
  cameraRef,
  setIsRecording,
  setIsFinalizing,
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
          setIsFinalizing(false);
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
    // Block the controls the instant stop is requested — the native finalize + save run after this,
    // and `onRecordingFinished` (which clears the guards) only fires once they complete.
    setIsFinalizing(true);

    try {
      await cameraRef.current.stopRecording();
    } catch (error) {
      isBusyRef.current = false;
      isStoppingRef.current = false;
      console.error('Failed to stop recording:', error);
      setIsRecording(false);
      setIsFinalizing(false);
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

interface RecorderFooterProps {
  isPortrait: boolean;
  isRecording: boolean;
  // The mode toggle sits just above the record button in portrait; when shown, the hint chip lifts
  // above it so the two never overlap.
  hasModeBar: boolean;
  sectionDescription?: string;
  showDescription: boolean;
  onDismissDescription: () => void;
  orientation: Orientation;
  t: TFunction<'recording'>;
}

// The pre-recording chrome: the dismissable section prompt and the orientation hint chip. Both hide
// once recording starts.
const RecorderFooter = ({
  isPortrait,
  isRecording,
  hasModeBar,
  sectionDescription,
  showDescription,
  onDismissDescription,
  orientation,
  t,
}: RecorderFooterProps) => {
  const portraitInstructions = hasModeBar ? styles.portraitInstructionsWithBar : styles.portraitInstructions;

  return (
    <>
      {sectionDescription && showDescription && !isRecording && (
        <DescriptionOverlay isPortrait={isPortrait} description={sectionDescription} onDismiss={onDismissDescription} />
      )}
      {!isRecording && (
        <View style={[styles.instructionChip, isPortrait ? portraitInstructions : styles.landscapeInstructions]}>
          <Ionicons
            name={isPortrait ? 'phone-portrait-outline' : 'phone-landscape-outline'}
            size={13}
            color="rgba(255,255,255,0.7)"
          />
          <Text style={styles.instructionText}>{getInstructionText(orientation, t)}</Text>
        </View>
      )}
    </>
  );
};

interface PermissionGateProps {
  isCheckingPermissions: boolean;
  hasPermission: boolean | null;
  device: ReturnType<typeof useCameraDevice>;
  dimensions: { width: number; height: number };
  t: TFunction<'recording'>;
}

// Returns the blocking state (permission check, denied, or no camera) to show instead of the
// recorder, or null when the camera is ready. Pulling these out of VideoRecorder keeps its branch
// count down.
const permissionGate = ({
  isCheckingPermissions,
  hasPermission,
  device,
  dimensions,
  t,
}: PermissionGateProps): React.ReactElement | null => {
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

  return null;
};

const VideoRecorder: React.FC<VideoRecorderProps> = ({
  orientation,
  onVideoRecorded,
  sectionDescription,
  fullscreen = false,
  countdownSeconds,
  maxDurationSeconds,
  framingGuide,
  onFinalizingChange,
  allowedModes = DEFAULT_MODES,
}) => {
  const { t } = useTranslation('recording');
  const [isRecording, setIsRecording] = useState(false);
  const { isFinalizing, setIsFinalizing } = useFinalizingSync(onFinalizingChange);
  const { showDescription, dismiss: dismissDescription } = useDescriptionOverlay();
  const { activeMode, cameraType, handleModeChange, pickVideo, flipCamera, showModeBar, isUploadMode } = useCaptureMode(
    { allowedModes, onVideoRecorded, orientation }
  );
  const cameraRef = useRef<Camera | null>(null);
  const device = useCameraDevice(cameraType);
  const { hasPermission, isCheckingPermissions } = useCameraPermissions();
  const recordingDuration = useRecordingTimer(isRecording);
  const pulseAnim = usePulseAnimation(isRecording);
  // Square records with the phone upright, so it shares the portrait chrome layout (timer/flip/controls).
  const isPortrait = orientation !== 'landscape';
  const { handleRecordPress } = useRecordingActions({
    cameraRef,
    setIsRecording,
    setIsFinalizing,
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

  const containerStyle = fullscreen ? styles.fullscreenContainer : styles.container;

  if (isUploadMode) {
    return (
      <View style={containerStyle}>
        <StatusBar hidden backgroundColor="transparent" translucent />
        <UploadPlaceholder onPick={pickVideo} />
        <ModeBarOrFlip
          showModeBar={showModeBar}
          allowedModes={allowedModes}
          activeMode={activeMode}
          onModeChange={handleModeChange}
          isPortrait={isPortrait}
          isBusy={false}
          onFlip={flipCamera}
        />
      </View>
    );
  }

  const gate = permissionGate({
    isCheckingPermissions,
    hasPermission,
    device,
    dimensions: getPreviewDimensions(orientation, fullscreen),
    t,
  });

  if (gate) return gate;

  // The gate already covers a missing device; this narrows the type for <Camera> below.
  if (!device) return null;

  return (
    <View style={containerStyle}>
      <StatusBar hidden backgroundColor="transparent" translucent />
      <CameraBody cameraRef={cameraRef} device={device} orientation={orientation} />
      {/* Top + bottom scrims keep the header, description and controls legible over any camera frame. */}
      <LinearGradient pointerEvents="none" colors={TOP_SCRIM_COLORS} style={styles.topScrim} />
      <LinearGradient pointerEvents="none" colors={BOTTOM_SCRIM_COLORS} style={styles.bottomScrim} />
      <FramingGuideOverlayWhenLive guide={framingGuide} orientation={orientation} />
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
      <ModeBarOrFlip
        showModeBar={showModeBar}
        allowedModes={allowedModes}
        activeMode={activeMode}
        onModeChange={handleModeChange}
        isPortrait={isPortrait}
        isBusy={isRecording || isFinalizing}
        onFlip={flipCamera}
      />
      <View style={[styles.controls, isPortrait ? styles.portraitControls : styles.landscapeControls]}>
        <TouchableOpacity
          style={[styles.recordButton, isRecording && styles.stopButton]}
          onPress={onRecordButtonPress}
          disabled={isFinalizing}
        >
          <Animated.View style={[styles.recordIcon, { transform: [{ scale: pulseAnim }] }]} />
        </TouchableOpacity>
      </View>
      <RecorderFooter
        isPortrait={isPortrait}
        isRecording={isRecording}
        hasModeBar={showModeBar}
        sectionDescription={sectionDescription}
        showDescription={showDescription}
        onDismissDescription={dismissDescription}
        orientation={orientation}
        t={t}
      />
      <FinalizingOverlay visible={isFinalizing} t={t} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', position: 'relative' },
  fullscreenContainer: { flex: 1, backgroundColor: '#000', position: 'relative' },
  camera: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 },
  // Centered 1:1 viewfinder for square templates: black bars fill the rest of the screen.
  squareFrameWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squareFrame: { overflow: 'hidden', position: 'relative' },
  // Above every other overlay (timer is zIndex 50) so it fully captures touches during the freeze.
  finalizingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11,11,15,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.m,
    zIndex: 100,
  },
  finalizingText: { ...typography.body, color: 'white', fontSize: 15 },
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
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 220, zIndex: 1 },
  bottomScrim: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 280, zIndex: 1 },
  descriptionOverlay: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    backgroundColor: 'rgba(11,11,15,0.78)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.m,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  portraitDescriptionOverlay: { top: 96, left: 16, right: 16 },
  landscapeDescriptionOverlay: { top: 76, left: 100, maxWidth: '50%' },
  descriptionIcon: { marginTop: 1 },
  descriptionClose: { marginTop: 1 },
  descriptionOverlayText: {
    ...typography.body,
    flex: 1,
    color: 'white',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  instructionChip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 6,
    backgroundColor: 'rgba(11,11,15,0.5)',
    paddingVertical: 6,
    paddingHorizontal: spacing.m,
    borderRadius: 999,
    zIndex: 4,
  },
  instructionText: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
  },
  portraitInstructions: { bottom: 150 },
  // Lifted clear of the mode toggle (which sits at bottom 146, ~38pt tall) with an 8pt-rhythm gap.
  portraitInstructionsWithBar: { bottom: 206 },
  landscapeInstructions: { bottom: 20 },
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
  // Centering wrapper for the segmented control; sits just above the record button (which spans
  // bottom 50–130), with the hint chip lifted above it (portraitInstructionsWithBar).
  captureModeBar: {
    position: 'absolute',
    bottom: 146,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  captureModeTrack: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(11,11,15,0.6)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  captureModeSegment: {
    minWidth: 88,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureModeSegmentActive: {
    backgroundColor: 'white',
  },
  captureModeSegmentText: {
    ...typography.button,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
  },
  captureModeSegmentTextActive: {
    color: colors.text,
    fontWeight: '700',
  },
  uploadPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.l,
    paddingHorizontal: spacing.xl,
  },
  uploadLabel: {
    ...typography.body,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    fontSize: 18,
  },
  uploadButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.xl,
    borderRadius: 999,
  },
  uploadButtonText: {
    ...typography.button,
    color: 'white',
  },
});

export default VideoRecorder;
