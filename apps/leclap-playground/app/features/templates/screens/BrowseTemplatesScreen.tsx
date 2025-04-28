import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, SafeAreaView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import TemplateList from '../components/TemplateList';
import { fetchTemplates } from '../../../services/api';
import { Template } from '@/app/types';
import { colors, spacing, typography } from '@/app/styles/theme';
import Constants from 'expo-constants';

const BrowseTemplatesScreen = () => {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
    
    // Debug API URL configuration
    const apiUrl = Constants.expoConfig?.extra?.API_URL;
  }, []);

  const loadTemplates = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await fetchTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Error in template loading:', err);
      setError('Failed to load templates.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTemplate = (template: Template) => {
    // Use router.push with the pathname and params
    router.push({
      pathname: '/(app)/template/[id]',
      params: { id: template.name },
    });
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading templates...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.errorSubtext}>
          Make sure the ffmpeg-video-composer server is running.
        </Text>
        <View style={styles.buttonContainer}>
          <Text style={styles.retryButton} onPress={loadTemplates}>
            Try Again
          </Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.screenTitle}>Scenarios</Text>
      <Text style={styles.subtitle}>Select a scenario to create your video</Text>
      
      <TemplateList
        templates={templates}
        onSelectTemplate={handleSelectTemplate}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 5,
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
