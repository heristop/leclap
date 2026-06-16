import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StatusBar } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '@/src/styles/theme';
import { styles } from './previewStyles';

/** Full-screen loading state while the project is being fetched. */
export function PreviewLoading() {
  const { t } = useTranslation('preview');

  return (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingText}>{t('loading')}</Text>
    </View>
  );
}

/** Error state with a back affordance. */
export function PreviewError({ message, onBack }: { message: string; onBack: () => void }) {
  const { t } = useTranslation('common');

  return (
    <View style={styles.centerContainer}>
      <Text style={styles.errorText}>{message}</Text>
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>{t('actions.back')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function VideoNotAvailable({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation('preview');

  return (
    <View style={styles.centerContainer}>
      <Text style={styles.errorText}>{t('notAvailable')}</Text>
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>{t('actions.back', { ns: 'common' })}</Text>
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
