import React, { Suspense, lazy, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import type { VideoFile } from 'react-native-vision-camera';
import { colors } from '@/src/styles/theme';
import BrowseTemplatesScreen from '../features/templates/screens/BrowseTemplatesScreen';

// Lazy-load the camera modal so react-native-vision-camera (and its native CameraX
// bindings) initialize only when the user opens the camera, not at home-screen module
// load. This keeps the home screen renderable even if the camera native module has issues.
const CameraModal = lazy(() => import('../components/CameraModal'));

export default function ScenariosTab() {
  const [cameraModalVisible, setCameraModalVisible] = useState(false);

  // Show camera modal
  const openCameraModal = () => {
    setCameraModalVisible(true);
  };

  // Handle recorded video
  const handleVideoRecorded = (_video: VideoFile) => {};

  return (
    <View style={styles.container}>
      <BrowseTemplatesScreen onRecordPress={openCameraModal} />

      {/* Camera Modal — only mounted when opened so VisionCamera loads on demand */}
      {cameraModalVisible && (
        <Suspense fallback={null}>
          <CameraModal
            visible={cameraModalVisible}
            onClose={() => {
              setCameraModalVisible(false);
            }}
            onVideoRecorded={handleVideoRecorded}
          />
        </Suspense>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
