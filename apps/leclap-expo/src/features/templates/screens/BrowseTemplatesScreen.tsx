import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import TemplateList from '../components/TemplateList';
import { useTemplates } from '@/src/hooks/useTemplates';
import type { Template } from '@/src/types';
import { colors, spacing, typography } from '@/src/styles/theme';
import { CompilationQueueStatus } from '../../../components/ui/CompilationQueueStatus';
import { TemplateListSkeleton } from '../../../components/ui/SkeletonLoader';
import Button from '../../../components/ui/Button';
import * as Haptics from 'expo-haptics';

interface BrowseTemplatesScreenProps {
  onRecordPress?: () => void;
}

const BrowseTemplatesScreen = ({ onRecordPress: _onRecordPress }: BrowseTemplatesScreenProps) => {
  const router = useRouter();
  const { t } = useTranslation('templates');
  const { data: templates = [], isLoading, error, refetch } = useTemplates();
  // The catalog is bundled and renders on-device, so being offline never degrades the experience.
  const offlineForUi = false;

  const handleSelectTemplate = (template: Template) => {
    const navigate = () => {
      router.push({
        pathname: '/template/[id]',
        params: { id: template.name },
      });
    };
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).then(navigate).catch(navigate);
  };

  const goCreateTemplate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push('/(fullscreen)/create-template');
  };

  if (isLoading && templates.length === 0) {
    return (
      <View style={styles.container}>
        <CompilationQueueStatus />

        <Text style={styles.screenTitle}>{t('screenTitle')}</Text>
        <Text style={styles.subtitle}>{t('subtitle')}</Text>

        <TemplateListSkeleton count={6} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error instanceof Error ? error.message : t('loadError')}</Text>
        <Text style={styles.errorSubtext}>{t('loadErrorHint')}</Text>
        <View style={{ marginTop: spacing.m, alignItems: 'center', height: 160 }}>
          <Button
            variant="primary"
            onPress={() => {
              refetch().catch(console.error);
            }}
            icon="refresh"
            size="large"
            fullWidth={false}
          >
            {t('actions.tryAgain', { ns: 'common' })}
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CompilationQueueStatus />

      <TemplateList
        templates={templates}
        onSelectTemplate={handleSelectTemplate}
        isOffline={offlineForUi}
        onRefresh={() => {
          refetch().catch(console.error);
        }}
        screenTitle={t('screenTitle')}
        subtitle={t('subtitle')}
      />

      <TouchableOpacity
        testID="create-template-fab"
        onPress={goCreateTemplate}
        style={styles.fab}
        activeOpacity={0.85}
        accessibilityLabel={t('createTemplate')}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.l,
    backgroundColor: colors.background,
  },
  screenTitle: {
    ...typography.title,
    marginHorizontal: spacing.m,
    marginBottom: spacing.s,
  },
  subtitle: {
    ...typography.caption,
    marginHorizontal: spacing.m,
    marginBottom: spacing.m,
  },
  loadingText: {
    ...typography.body,
    marginTop: spacing.m,
  },
  errorText: {
    ...typography.subtitle,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.m,
  },
  errorSubtext: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.xl,
    color: colors.textSecondary,
  },
  fab: {
    position: 'absolute',
    right: spacing.l,
    bottom: spacing.l,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});

export default BrowseTemplatesScreen;
