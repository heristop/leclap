import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StatusBar } from 'react-native';
import { colors } from '@/src/styles/theme';
import { styles } from './previewStyles';

/** Full-screen loading state while the project is being fetched. */
export function PreviewLoading() {
  return (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingText}>Loading preview...</Text>
    </View>
  );
}

/** Error state with a back affordance. */
export function PreviewError({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <View style={styles.centerContainer}>
      <Text style={styles.errorText}>{message}</Text>
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

function VideoNotAvailable({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.centerContainer}>
      <Text style={styles.errorText}>Video not available for preview.</Text>
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

/** Full-screen state shown when there is no video URI to play. */
export function PreviewNoVideo({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.fullscreenContainer}>
      <StatusBar hidden translucent backgroundColor="transparent" />
      <VideoNotAvailable onBack={onBack} />
    </View>
  );
}
