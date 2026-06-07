import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import type { Project } from '@/src/types';
import { colors, spacing, typography } from '@/src/styles/theme';
import SwipeableProjectItem from '@/app/components/ui/SwipeableProjectItem';
import ConfirmDialog from '@/app/components/ui/dialog/ConfirmDialog';
import { useProjectStore } from '@/src/stores/useProjectStore';
import { useProjectService } from '@/src/presentation/hooks/useProjectService';

function EmptyState() {
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name="videocam-outline" size={64} color={colors.divider} />
      <Text style={styles.emptyTitle}>No videos yet</Text>
      <Text style={styles.emptyText}>
        Start by creating a new video from the Scenarios tab
      </Text>
    </View>
  );
}

function useProjectsScreenState() {
  const router = useRouter();
  const rawProjects = useProjectStore((state) => state.projects);
  const { loadProjects, deleteProject, deleteAllProjects } = useProjectService();
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const projects = (() => {
    // Return a new sorted array (newest first) without mutating the store's array.
    // Spread + sort (Hermes lacks Array.prototype.toSorted).
    return [...rawProjects].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  })();

  useFocusEffect(
    () => {
      loadProjects().catch(console.error);
    }
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadProjects().then(() => { setRefreshing(false); }).catch(console.error);
  };

  const handleDeleteProject = async (projectId: string) => {
    await deleteProject(projectId);
  };

  const handleProjectPress = (project: Project) => {
    if (project.status === 'completed' && project.outputVideoUri) {
      router.push({
        pathname: '/(fullscreen)/preview',
        params: {
          projectId: project.id,
          videoUri: project.outputVideoUri
        }
      });

      return;
    }

    router.push({
      pathname: '/(app)/template/[id]',
      params: {
        id: project.templateName,
        projectId: project.id
      }
    });
  };

  const handleDeleteAllProjects = () => {
    deleteAllProjects()
      .then(() => { setShowDeleteAllDialog(false); })
      .catch((error: unknown) => {
        console.error('Error deleting all projects:', error);
        Alert.alert('Error', 'Failed to delete all projects. Please try again.');
        setShowDeleteAllDialog(false);
      });
  };

  return {
    projects,
    refreshing,
    showDeleteAllDialog,
    setShowDeleteAllDialog,
    handleRefresh,
    handleDeleteProject,
    handleProjectPress,
    handleDeleteAllProjects,
  };
}

export default function ProjectsScreen() {
  const router = useRouter();
  const {
    projects,
    refreshing,
    showDeleteAllDialog,
    setShowDeleteAllDialog,
    handleRefresh,
    handleDeleteProject,
    handleProjectPress,
    handleDeleteAllProjects,
  } = useProjectsScreenState();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.innerContainer}>
      <Text style={styles.screenTitle}>My Videos</Text>

      <TouchableOpacity
        style={styles.createNewButton}
        onPress={() =>{ router.push('/(app)'); }}
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
            onPress={() =>{ handleProjectPress(item); }}
            onDelete={() => handleDeleteProject(item.id)}
          />
        )}
        ListEmptyComponent={<EmptyState />}
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
        onConfirm={handleDeleteAllProjects}
        onCancel={() =>{ setShowDeleteAllDialog(false); }}
      />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  innerContainer: {
    flex: 1,
  },
  screenTitle: {
    ...typography.title,
    marginHorizontal: spacing.m,
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
    padding: spacing.l,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: spacing.l,
    backgroundColor: colors.surface,
    borderRadius: 16,
    margin: spacing.m,
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
