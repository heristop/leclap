import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '@/src/styles/theme';
import ProjectsScreen from '../../features/projects/screens/ProjectsScreen';
import CameraModal from '../../components/CameraModal';

export default function VideosTab() {
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  
  // Handle recorded video
  const handleVideoRecorded = (video) => {
    // Handle the recorded video here
  };

  return (
    <View style={styles.container}>
      <ProjectsScreen />
      
      {/* Camera Modal */}
      <CameraModal
        visible={cameraModalVisible}
        onClose={() => setCameraModalVisible(false)}
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
