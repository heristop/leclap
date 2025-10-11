import React from 'react';
import { View, StyleSheet, Text, ActivityIndicator, SafeAreaView, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import TemplateList from '../components/TemplateList';
import { useTemplates } from '../../../hooks/useTemplates';
import { Template } from '@/app/types';
import { colors, spacing, typography } from '@/app/styles/theme';
import { NetworkStatusIndicator } from '../../../components/ui/NetworkStatusIndicator';
import { CompilationQueueStatus } from '../../../components/ui/CompilationQueueStatus';
import { TemplateListSkeleton } from '../../../components/ui/SkeletonLoader';
import { useOffline } from '../../../providers/OfflineProvider';
import * as Haptics from 'expo-haptics';

const BrowseTemplatesScreen = () => {
  const router = useRouter();
  const { data: templates = [], isLoading, error, refetch } = useTemplates();
  const { isOffline } = useOffline();
  const [refreshing, setRefreshing] = React.useState(false);

  const handleSelectTemplate = async (template: Template) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(app)/template/[id]',
      params: { id: template.name },
    });
  };

  const handleRefresh = async () => {
    if (isOffline) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRefreshing(true);

    try {
      await refetch();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading && templates.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <NetworkStatusIndicator showSyncStatus={false} />
        <CompilationQueueStatus />

        <Text style={styles.screenTitle}>Scenarios</Text>
        <Text style={styles.subtitle}>Select a scenario to create your video</Text>

        <TemplateListSkeleton count={6} />
      </SafeAreaView>
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
        <View style={styles.buttonContainer}>
          <Text style={styles.retryButton} onPress={() => refetch()}>
            Try Again
          </Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <NetworkStatusIndicator
        showSyncStatus={true}
        expandable={true}
      />
      <CompilationQueueStatus />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            title={isOffline ? "Pull to sync when online" : "Pull to refresh"}
            titleColor={colors.textSecondary}
            colors={[colors.primary]}
          />
        }
      >
        <Text style={styles.screenTitle}>Scenarios</Text>
        <Text style={styles.subtitle}>
          {isOffline
            ? "📴 Browsing cached templates (offline)"
            : "Select a scenario to create your video"
          }
        </Text>

        <TemplateList
          templates={templates}
          onSelectTemplate={handleSelectTemplate}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 5,
  },
  scrollView: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  screenTitle: {
    ...typography.title,
    margin: spacing.m,
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
  buttonContainer: {
    marginTop: spacing.m,
  },
  retryButton: {
    ...typography.body,
    color: colors.primary,
    padding: spacing.m,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    textAlign: 'center',
  }
});

export default BrowseTemplatesScreen;
