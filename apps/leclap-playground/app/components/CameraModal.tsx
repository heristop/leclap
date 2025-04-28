import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  StatusBar,
  TouchableOpacity,
  Text,
  Modal,
  BackHandler
} from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { Ionicons } from '@expo/vector-icons';

// A standalone camera component that doesn't use navigation at all
const CameraModal = ({ visible, onClose, onVideoRecorded }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [cameraType, setCameraType] = useState('back');
  const device = useCameraDevice(cameraType);
  const cameraRef = useRef(null);
  
  // Force hide status bar
  useEffect(() => {
    if (visible) {
      StatusBar.setHidden(true, 'none');
    }
    return () => StatusBar.setHidden(false);
  }, [visible]);
  
  // Handle back button
  useEffect(() => {
    const backAction = () => {
      if (visible) {
        onClose();
        return true;
      }
      return false;
    };
    
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [visible, onClose]);
  
  // Handle recording
  const startRecording = async () => {
    if (!cameraRef.current || isRecording) return;
    
    try {
      setIsRecording(true);
      
      cameraRef.current.startRecording({
        fileType: 'mp4',
        videoCodec: 'h264',
        onRecordingFinished: (video) => {
          setIsRecording(false);
          if (onVideoRecorded) {
            onVideoRecorded(video);
          }
          onClose();
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
    
    await cameraRef.current.stopRecording();
  };
  
  if (!device) {
    return (
      <Modal
        animationType="fade"
        transparent={false}
        visible={visible}
        onRequestClose={onClose}
      >
        <View style={styles.errorContainer}>
          <StatusBar hidden={true} />
          <Text style={styles.errorText}>No camera device available</Text>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={onClose}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }
  
  return (
    <Modal
      animationType="fade"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <StatusBar hidden={true} />
        
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={visible}
          video={true}
          audio={true}
        />
        
        {/* Record button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.recordButton, isRecording && styles.recordingButton]}
            onPress={isRecording ? stopRecording : startRecording}
          >
            {isRecording ? (
              <View style={styles.stopIcon} />
            ) : (
              <View style={styles.recordIcon} />
            )}
          </TouchableOpacity>
        </View>
        
        {/* Camera flip button */}
        <TouchableOpacity
          style={styles.flipButton}
          onPress={() => setCameraType(current => current === 'back' ? 'front' : 'back')}
        >
          <Ionicons
            name="camera-reverse-outline"
            size={24}
            color="white"
          />
        </TouchableOpacity>
        
        {/* Close button */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
        >
          <Ionicons
            name="close-outline"
            size={28}
            color="white"
          />
        </TouchableOpacity>
        
        {/* Instruction text */}
        <View style={styles.instructionContainer}>
          <Text style={styles.instructionText}>
            Hold your device vertically for best results
          </Text>
        </View>
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
