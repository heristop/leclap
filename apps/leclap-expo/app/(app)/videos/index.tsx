import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '@/src/styles/theme';
import ProjectsScreen from '@/src/features/projects/screens/ProjectsScreen';
import CameraModal from '@/src/components/CameraModal';

export default function VideosTab() {
  const [cameraModalVisible, setCameraModalVisible] = useState(false);

  // Handle recorded video
  const handleVideoRecorded = (_video: unknown) => {
    // Handle the recorded video here
  };

  return (
    <View style={styles.container}>
      <ProjectsScreen />

      {/* Camera Modal */}
      <CameraModal
        visible={cameraModalVisible}
        onClose={() => {
          setCameraModalVisible(false);
        }}
        onVideoRecorded={handleVideoRecorded}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
