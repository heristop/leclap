import { View, Text, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '@/src/styles/theme';
import { PressableScale } from '@/src/components/kinetic/pressable-scale';
import { styles } from '@/src/features/templates/detail/detail.styles';

export const LoadingState = () => {
  const { t } = useTranslation('detail');

  return (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingText}>{t('loading')}</Text>
    </View>
  );
};

interface ErrorStateProps {
  error: unknown;
  onBack: () => void;
}

export const ErrorState = ({ error, onBack }: ErrorStateProps) => {
  const { t } = useTranslation('detail');

  return (
    <View style={styles.centerContainer}>
      <Text style={styles.errorText}>{error instanceof Error ? error.message : t('notFound')}</Text>
      <PressableScale style={styles.stateBackButton} onPress={onBack}>
        <Text style={styles.stateBackButtonText}>{t('backToTemplates')}</Text>
      </PressableScale>
    </View>
  );
};
