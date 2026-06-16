import { Camera } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { Alert, Linking } from 'react-native';
import i18n from '@/src/i18n';

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
    Alert.alert(i18n.t('permissions.camera.title'), i18n.t('permissions.camera.message'), [
      { text: i18n.t('actions.cancel', { ns: 'common' }), style: 'cancel' },
      {
        text: i18n.t('permissions.openSettings'),
        onPress: () => {
          Linking.openSettings().catch(() => {});
        },
      },
    ]);

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
    Alert.alert(i18n.t('permissions.microphone.title'), i18n.t('permissions.microphone.message'), [
      { text: i18n.t('actions.cancel', { ns: 'common' }), style: 'cancel' },
      {
        text: i18n.t('permissions.openSettings'),
        onPress: () => {
          Linking.openSettings().catch(() => {});
        },
      },
    ]);

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
    Alert.alert(i18n.t('permissions.mediaLibrary.title'), i18n.t('permissions.mediaLibrary.message'), [
      { text: i18n.t('actions.cancel', { ns: 'common' }), style: 'cancel' },
      {
        text: i18n.t('permissions.openSettings'),
        onPress: () => {
          Linking.openSettings().catch(() => {});
        },
      },
    ]);

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
