import React, { Suspense, lazy, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '@/src/styles/theme';
import ProjectsScreen from '@/src/features/projects/screens/ProjectsScreen';

// Lazy-load the camera modal so react-native-vision-camera (and its native bindings)
// initialize only when the user opens the camera, not at tab module load. This keeps the
// Videos tab renderable even if the camera native module has issues.
const CameraModal = lazy(() => import('@/src/components/CameraModal'));

export default function VideosTab() {
  const [cameraModalVisible, setCameraModalVisible] = useState(false);

  // Handle recorded video
  const handleVideoRecorded = (_video: unknown) => {
    // Handle the recorded video here
  };

  return (
    <View style={styles.container}>
      <ProjectsScreen />

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
