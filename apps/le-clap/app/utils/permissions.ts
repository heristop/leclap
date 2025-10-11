import * as ImagePicker from 'expo-image-picker';
import * as Camera from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { Alert, Linking, Platform } from 'react-native';

/**
 * Utility functions for handling app permissions
 */

/**
 * Request camera permission
 * @returns {Promise<boolean>} Whether permission was granted
 */
export const requestCameraPermission = async (): Promise<boolean> => {
  const { status: existingStatus } = await Camera.getCameraPermissionsAsync();

  if (existingStatus === 'granted') {
    return true;
  }

  const { status } = await Camera.requestCameraPermissionsAsync();

  if (status !== 'granted') {
    Alert.alert(
      'Camera Permission Required',
      'We need camera access to record videos. Please grant permission in your device settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => {
            Linking.openSettings();
          },
        },
      ]
    );
    return false;
  }

  return true;
};

/**
 * Request audio recording permission
 * @returns {Promise<boolean>} Whether permission was granted
 */
export const requestAudioPermission = async (): Promise<boolean> => {
  const { status: existingStatus } = await Camera.getMicrophonePermissionsAsync();

  if (existingStatus === 'granted') {
    return true;
  }

  const { status } = await Camera.requestMicrophonePermissionsAsync();

  if (status !== 'granted') {
    Alert.alert(
      'Microphone Permission Required',
      'We need microphone access to record audio in your videos. Please grant permission in your device settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => {
            Linking.openSettings();
          },
        },
      ]
    );
    return false;
  }

  return true;
};

/**
 * Request media library permission
 * @returns {Promise<boolean>} Whether permission was granted
 */
export const requestMediaLibraryPermission = async (): Promise<boolean> => {
  const { status: existingStatus } = await MediaLibrary.getPermissionsAsync();

  if (existingStatus === 'granted') {
    return true;
  }

  const { status } = await MediaLibrary.requestPermissionsAsync();

  if (status !== 'granted') {
    Alert.alert(
      'Media Library Permission Required',
      'We need access to your media library to save videos. Please grant permission in your device settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => {
            Linking.openSettings();
          },
        },
      ]
    );
    return false;
  }

  return true;
};

/**
 * Request all necessary video recording permissions at once
 * @returns {Promise<boolean>} Whether all permissions were granted
 */
export const requestVideoPermissions = async (): Promise<boolean> => {
  const cameraPermission = await requestCameraPermission();
  const audioPermission = await requestAudioPermission();
  const mediaLibraryPermission = await requestMediaLibraryPermission();

  return cameraPermission && audioPermission && mediaLibraryPermission;
};

const PermissionsUtils = {
  name: 'Permissions',
};
export default PermissionsUtils;
