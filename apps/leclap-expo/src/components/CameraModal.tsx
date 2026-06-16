import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, StatusBar, TouchableOpacity, Text, Modal, BackHandler } from 'react-native';
import {
  Camera,
  useCameraDevice,
  type CameraPosition,
  type VideoFile,
  type CameraCaptureError,
} from 'react-native-vision-camera';
import { Ionicons } from '@expo/vector-icons';

interface CameraModalProps {
  visible: boolean;
  onClose: () => void;
  onVideoRecorded: (video: VideoFile) => void;
}

// Extracted helper: no-device fallback
function NoCameraView({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal animationType="fade" transparent={false} visible={visible} onRequestClose={onClose}>
      <View style={styles.errorContainer}>
        <StatusBar hidden />
        <Text style={styles.errorText}>No camera device available</Text>
        <TouchableOpacity style={styles.backButton} onPress={onClose}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// Extracted helper: record button
function RecordButton({
  isRecording,
  onStart,
  onStop,
}: {
  isRecording: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  const handlePress = () => {
    if (isRecording) {
      onStop();

      return;
    }
    onStart();
  };

  return (
    <View style={styles.buttonContainer}>
      <TouchableOpacity style={[styles.recordButton, isRecording && styles.recordingButton]} onPress={handlePress}>
        {isRecording ? <View style={styles.stopIcon} /> : <View style={styles.recordIcon} />}
      </TouchableOpacity>
    </View>
  );
}

// Extracted helper: camera overlay controls
function CameraControls({
  isRecording,
  onStart,
  onStop,
  onFlip,
  onClose,
}: {
  isRecording: boolean;
  onStart: () => void;
  onStop: () => void;
  onFlip: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <RecordButton isRecording={isRecording} onStart={onStart} onStop={onStop} />
      <TouchableOpacity style={styles.flipButton} onPress={onFlip}>
        <Ionicons name="camera-reverse-outline" size={24} color="white" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Ionicons name="close-outline" size={28} color="white" />
      </TouchableOpacity>
      <View style={styles.instructionContainer}>
        <Text style={styles.instructionText}>Hold your device vertically for best results</Text>
      </View>
    </>
  );
}

// Hook: status bar and back button side effects
function useCameraModalEffects(visible: boolean, onClose: () => void) {
  useEffect(() => {
    if (visible) {
      StatusBar.setHidden(true, 'none');
    }

    return () => {
      StatusBar.setHidden(false);
    };
  }, [visible]);

  useEffect(() => {
    const backAction = () => {
      if (visible) {
        onClose();

        return true;
      }

      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => {
      backHandler.remove();
    };
  }, [visible, onClose]);
}

// A standalone camera component that doesn't use navigation at all
const CameraModal = ({ visible, onClose, onVideoRecorded }: CameraModalProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [cameraType, setCameraType] = useState<CameraPosition>('back');
  const device = useCameraDevice(cameraType);
  const cameraRef = useRef<Camera>(null);

  useCameraModalEffects(visible, onClose);

  const startRecording = () => {
    if (cameraRef.current === null || isRecording) return;

    try {
      setIsRecording(true);
      cameraRef.current.startRecording({
        fileType: 'mp4',
        videoCodec: 'h264',
        onRecordingFinished: (video: VideoFile) => {
          setIsRecording(false);
          onVideoRecorded(video);
          onClose();
        },
        onRecordingError: (error: CameraCaptureError) => {
          console.error('Recording error:', error);
          setIsRecording(false);
        },
      });
    } catch (error) {
      console.error('Failed to start recording:', error);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (cameraRef.current === null || !isRecording) return;
    cameraRef.current.stopRecording().catch((error: unknown) => {
      console.error('Failed to stop recording:', error);
    });
  };

  const flipCamera = () => {
    setCameraType((current) => (current === 'back' ? 'front' : 'back'));
  };

  if (!device) {
    return <NoCameraView visible={visible} onClose={onClose} />;
  }

  return (
    <Modal animationType="fade" transparent={false} visible={visible} onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.container}>
        <StatusBar hidden />
        <Camera ref={cameraRef} style={StyleSheet.absoluteFill} device={device} isActive={visible} video audio />
        <CameraControls
          isRecording={isRecording}
          onStart={startRecording}
          onStop={stopRecording}
          onFlip={flipCamera}
          onClose={onClose}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
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
  recordingButton: {
    backgroundColor: 'rgba(255, 100, 100, 0.3)',
  },
  recordIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'red',
  },
  stopIcon: {
    width: 30,
    height: 30,
    backgroundColor: 'red',
    borderRadius: 3,
  },
  flipButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionContainer: {
    position: 'absolute',
    bottom: 150,
    left: 20,
    right: 20,
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 10,
  },
  instructionText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
  },
  errorText: {
    color: 'white',
    fontSize: 16,
    marginBottom: 20,
  },
  backButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#3E64FF',
    borderRadius: 10,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
  },
});

export default CameraModal;
