import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import TemplateList from '../components/TemplateList';
import { useTemplates } from '@/src/hooks/useTemplates';
import { Template } from '@/src/types';
import { colors, spacing, typography } from '@/src/styles/theme';
import { NetworkStatusIndicator } from '../../../components/ui/NetworkStatusIndicator';
import { CompilationQueueStatus } from '../../../components/ui/CompilationQueueStatus';
import { TemplateListSkeleton } from '../../../components/ui/SkeletonLoader';
import { useOffline } from '@/src/providers/OfflineProvider';
import Button from '../../../components/ui/Button';
import * as Haptics from 'expo-haptics';

interface BrowseTemplatesScreenProps {
  onRecordPress?: () => void;
}

const BrowseTemplatesScreen = ({ onRecordPress }: BrowseTemplatesScreenProps) => {
  const router = useRouter();
  const { data: templates = [], isLoading, error, refetch } = useTemplates();
  const { isOffline } = useOffline();

  const handleSelectTemplate = async (template: Template) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(app)/template/[id]',
      params: { id: template.name },
    });
  };


  if (isLoading && templates.length === 0) {
    return (
      <View style={styles.container}>
        <NetworkStatusIndicator showSyncStatus={false} />
        <CompilationQueueStatus />

        <Text style={styles.screenTitle}>Scenarios</Text>
        <Text style={styles.subtitle}>Select a scenario to create your video</Text>

        <TemplateListSkeleton count={6} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>
          {error instanceof Error ? error.message : 'Failed to load templates'}
        </Text>
        <Text style={styles.errorSubtext}>
          Make sure the ffmpeg-video-composer server is running.
        </Text>
        <View style={{ marginTop: spacing.s }}>
          <Button
            variant="primary"
            onPress={async () => { await refetch(); }}
            icon="refresh"
            size="medium"
          >
            Try Again
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NetworkStatusIndicator
        showSyncStatus={true}
        expandable={true}
      />
      <CompilationQueueStatus />

      <TemplateList
        templates={templates}
        onSelectTemplate={handleSelectTemplate}
        isOffline={isOffline}
        onRefresh={() => refetch()}
        screenTitle="Scenarios"
        subtitle={isOffline
          ? "📴 Browsing cached templates (offline)"
          : "Select a scenario to create your video"
        }
      />

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
});

export default BrowseTemplatesScreen;
