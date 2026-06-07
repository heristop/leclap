import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, StatusBar } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/src/styles/theme';

interface VideoPlayerProps {
  videoUri: string;
  onClose: () => void;
  onRetake?: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoUri, onClose, onRetake }) => {
  const player = useVideoPlayer(videoUri, (playerInstance) => {
    playerInstance.loop = true;
    playerInstance.play();
  });

  return (
    <View style={styles.container}>
      <View style={styles.videoContainer}>
        <StatusBar hidden translucent backgroundColor="transparent" />
        <VideoView
          style={styles.videoPlayer}
          player={player}
          nativeControls
          contentFit="contain"
        />
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          activeOpacity={0.7}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <Ionicons name="close" size={36} color="#000000" />
        </TouchableOpacity>

        {onRetake && (
          <TouchableOpacity
            style={styles.retakeButton}
            onPress={onRetake}
          >
            <Ionicons name="refresh" size={20} color="white" />
            <Text style={styles.buttonText}>Re-take</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  videoPlayer: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: 'white',
    ...typography.body,
  },
  controls: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.m,
    zIndex: 100,
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    padding: spacing.m,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.m,
    borderRadius: 20,
  },
  buttonText: {
    color: 'white',
    marginLeft: spacing.s,
    ...typography.body,
  },
});

export default VideoPlayer;