import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Project } from '@/app/types';
import { colors, spacing, typography } from '@/app/styles/theme';
import { getProjects, deleteAllProjects } from '@/app/services/api';
import SwipeableProjectItem from '@/app/components/ui/SwipeableProjectItem';
import ConfirmDialog from '@/app/components/ui/dialog/ConfirmDialog';

export default function ProjectsScreen() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const projectsData = await getProjects();
      const sortedProjects = projectsData.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setProjects(sortedProjects);
    } catch (err) {
      console.error('Error loading projects:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProjects();
    }, [loadProjects])
  );

  const [refreshing, setRefreshing] = useState(false);

  // Handle pull to refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProjects();
    setRefreshing(false);
  };

  const handleDeleteProject = useCallback((projectId: string) => {
    setProjects(currentProjects => currentProjects.filter(project => project.id !== projectId));
  }, []);

  const handleProjectPress = (project: Project) => {
    if (project.status === 'completed' && project.outputVideoUri) {
      router.push({
        pathname: '/(app)/preview',
        params: {
          projectId: project.id,
          videoUri: project.outputVideoUri
        }
      });
    } else {
      router.push({
        pathname: '/(app)/template/[id]',
        params: {
          id: project.templateName,
          projectId: project.id
        }
      });
    }
  };

  const handleDeleteAllProjects = async () => {
    try {
      await deleteAllProjects();
      setProjects([]); // Clear the local state
      setShowDeleteAllDialog(false); // Close the dialog
    } catch (error) {
      console.error('Error deleting all projects:', error);
      Alert.alert('Error', 'Failed to delete all projects. Please try again.');
      setShowDeleteAllDialog(false); // Close the dialog on error
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="videocam-outline" size={64} color={colors.divider} />
      <Text style={styles.emptyTitle}>No videos yet</Text>
      <Text style={styles.emptyText}>
        Start by creating a new video from the Scenarios tab
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>My Videos</Text>
      
      <TouchableOpacity 
        style={styles.createNewButton}
        onPress={() => router.push('/(app)')}
      >
        <Ionicons name="add-circle" size={22} color="white" />
        <Text style={styles.createNewButtonText}>Create New Video</Text>
      </TouchableOpacity>
      
      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SwipeableProjectItem
            project={item}
            onPress={() => handleProjectPress(item)}
            onDelete={() => handleDeleteProject(item.id)}
          />
        )}
        ListEmptyComponent={renderEmptyState()}
        contentContainerStyle={projects.length === 0 ? styles.emptyList : styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary, colors.secondary]}
            tintColor={colors.primary}
          />
        }
        windowSize={21}
        maxToRenderPerBatch={5}
        updateCellsBatchingPeriod={50}
        initialNumToRender={10}
      />

      {/* Delete All Confirmation Dialog */}
      <ConfirmDialog
        visible={showDeleteAllDialog}
        title="Delete All Projects"
        message="Are you sure you want to delete all your videos? This action cannot be undone."
        confirmText="Delete All"
        cancelText="Cancel"
        confirmIconName="trash"
        confirmType="danger"
        onConfirm={handleDeleteAllProjects} // Implement this function next
        onCancel={() => setShowDeleteAllDialog(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenTitle: {
    ...typography.title,
    margin: spacing.m,
    marginBottom: spacing.m,
  },
  createNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.m,
    marginHorizontal: spacing.m,
    marginBottom: spacing.m,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  createNewButtonText: {
    ...typography.body,
    color: 'white',
    fontWeight: '600',
    marginLeft: spacing.s,
    fontSize: 16,
  },
  list: {
    padding: spacing.m,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: 16,
    margin: spacing.l,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  emptyTitle: {
    ...typography.subtitle,
    marginTop: spacing.m,
    marginBottom: spacing.s,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
