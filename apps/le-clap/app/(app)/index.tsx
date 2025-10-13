import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '@/src/styles/theme';
import BrowseTemplatesScreen from '../features/templates/screens/BrowseTemplatesScreen';
import CameraModal from '../components/CameraModal';

export default function ScenariosTab() {
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  
  // Show camera modal
  const openCameraModal = () => {
    setCameraModalVisible(true);
  };
  
  // Handle recorded video
  interface Video {
    uri: string;
  }

  const handleVideoRecorded = (video: Video) => {
  };
  
  return (
    <View style={styles.container}>
      <BrowseTemplatesScreen onRecordPress={openCameraModal} />
      
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
