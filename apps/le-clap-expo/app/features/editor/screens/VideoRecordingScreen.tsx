import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  StyleSheet,
  StatusBar,
  Platform,
  BackHandler
} from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { Ionicons } from '@expo/vector-icons';
import { useOrientation } from '@/src/hooks/useOrientation';
import { useNavigation } from 'expo-router';

/**
 * This is a completely standalone screen for recording videos
 */
export const VideoRecordingScreen = ({ 
  orientation = 'portrait',
  onComplete,
  onCancel
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [cameraType, setCameraType] = useState('back');
  const device = useCameraDevice(cameraType);
  const cameraRef = useRef(null);
  const navigation = useNavigation();
  
  const { lockOrientation, unlockOrientation } = useOrientation(orientation);
  
  // Handle back button press
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (onCancel) {
        onCancel();
      }
      return true;
    });
    
    return () => backHandler.remove();
  }, [onCancel]);
  
  // Lock orientation when component mounts
  useEffect(() => {
    // Lock to the required orientation
    lockOrientation(orientation);
    
    // Hide all navigation bars
    if (Platform.OS === 'android') {
      StatusBar.setHidden(true);
    }
    
    return () => {
      // Unlock when component unmounts
      unlockOrientation();
      
      // Show navigation bars again
      if (Platform.OS === 'android') {
        StatusBar.setHidden(false);
      }
    };
  }, [orientation]);
  
  // Handle recording start
  const startRecording = async () => {
    if (!cameraRef.current || isRecording) return;
    
    try {
      setIsRecording(true);
      
      cameraRef.current.startRecording({
        fileType: 'mp4',
        videoCodec: 'h264',
        onRecordingFinished: (video) => {
          setIsRecording(false);
          if (onComplete) {
            onComplete(video, orientation);
          }
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
  
  // Handle recording stop
  const stopRecording = async () => {
    if (!cameraRef.current || !isRecording) return;
    
    await cameraRef.current.stopRecording();
  };
  
  if (!device) {
    return (
      <View style={styles.container}>
        <StatusBar hidden translucent backgroundColor="transparent" />
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <StatusBar hidden translucent backgroundColor="transparent" />
      
      <Camera
        ref={cameraRef}
        style={styles.camera}
        device={device}
        isActive={true}
        video={true}
        audio={true}
        orientation={orientation === 'portrait' ? 'portrait' : 'landscapeLeft'}
      />
      
      {/* Record button */}
      <View style={styles.buttonContainer}>
        <View 
          style={[
            styles.recordButton, 
            isRecording ? styles.recordingButton : null
          ]}
          onTouchEnd={isRecording ? stopRecording : startRecording}
        >
          {isRecording ? (
            <View style={styles.stopIcon} />
          ) : (
            <View style={styles.recordIcon} />
          )}
        </View>
      </View>
      
      {/* Camera flip button */}
      <View style={styles.flipButtonContainer}>
        <View
          style={styles.flipButton}
          onTouchEnd={() => setCameraType(current => current === 'back' ? 'front' : 'back')}
        >
          <Ionicons
            name="camera-reverse-outline"
            size={24}
            color="white"
          />
        </View>
      </View>
      
      {/* Cancel button */}
      <View style={styles.cancelButtonContainer}>
        <View
          style={styles.cancelButton}
          onTouchEnd={onCancel}
        >
          <Ionicons
            name="close-outline"
            size={24}
            color="white"
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'black',
    zIndex: 9999,
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
  flipButtonContainer: {
    position: 'absolute',
    top: 40,
    right: 20,
  },
  flipButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonContainer: {
    position: 'absolute',
    top: 40,
    left: 20,
  },
  cancelButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default VideoRecordingScreen;