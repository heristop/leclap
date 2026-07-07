import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { Project } from '@/src/types';
import { colors, spacing, typography, fonts } from '@/src/styles/theme';
import { elevation } from '@/src/styles/elevation';
import { KineticHeading } from '@/src/components/kinetic/kinetic-heading';
import { PressableScale } from '@/src/components/kinetic/pressable-scale';
import SwipeableProjectItem from '@/src/components/ui/SwipeableProjectItem';
import ConfirmDialog from '@/src/components/ui/dialog/ConfirmDialog';
import { useProjectStore } from '@/src/stores/useProjectStore';
import { useProjectService } from '@/src/presentation/hooks/useProjectService';

function EmptyState() {
  const { t } = useTranslation('projects');

  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="videocam-outline" size={40} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{t('empty.title')}</Text>
      <Text style={styles.emptyText}>{t('empty.subtitle')}</Text>
    </View>
  );
}

function useProjectsScreenState() {
  const router = useRouter();
  const { t } = useTranslation('projects');
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

  // useFocusEffect keeps `effect` in its dependency array, so the callback MUST be memoized — an
  // inline function re-runs the effect every render, and loadProjects → setProjects then re-renders,
  // spinning a refetch loop that locks the JS thread. loadProjects is now stable, so this runs on focus.
  useFocusEffect(
    useCallback(() => {
      loadProjects().catch(console.error);
    }, [loadProjects])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadProjects()
      .then(() => {
        setRefreshing(false);
      })
      .catch(console.error);
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
          videoUri: project.outputVideoUri,
        },
      });

      return;
    }

    router.push({
      pathname: '/template/[id]',
      params: {
        id: project.templateName,
        projectId: project.id,
      },
    });
  };

  const handleDeleteAllProjects = () => {
    deleteAllProjects()
      .then(() => {
        setShowDeleteAllDialog(false);
      })
      .catch((error: unknown) => {
        console.error('Error deleting all projects:', error);
        Alert.alert(t('alerts.deleteAllError.title'), t('alerts.deleteAllError.message'));
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
  const { t } = useTranslation('projects');
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
        <Text style={styles.kicker}>{t('kicker')}</Text>
        <View style={styles.titleWrap}>
          <KineticHeading text={t('title')} level="displayM" />
        </View>

        <PressableScale
          style={styles.createNewButton}
          haptic="medium"
          onPress={() => {
            router.push('/(app)');
          }}
          accessibilityLabel={t('createNew')}
        >
          <Ionicons name="add-circle" size={22} color="white" />
          <Text style={styles.createNewButtonText}>{t('createNew')}</Text>
        </PressableScale>

        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SwipeableProjectItem
              project={item}
              onPress={() => {
                handleProjectPress(item);
              }}
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
          title={t('deleteAll.title')}
          message={t('deleteAll.message')}
          confirmText={t('deleteAll.confirm')}
          cancelText={t('actions.cancel', { ns: 'common' })}
          confirmIconName="trash"
          confirmType="danger"
          onConfirm={handleDeleteAllProjects}
          onCancel={() => {
            setShowDeleteAllDialog(false);
          }}
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
  kicker: {
    fontFamily: fonts.poppins.semiBold,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.primary,
    marginHorizontal: spacing.m,
    marginTop: spacing.s,
    marginBottom: spacing.xs,
  },
  titleWrap: {
    marginHorizontal: spacing.m,
    marginBottom: spacing.m,
  },
  createNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s,
    backgroundColor: colors.primary,
    paddingVertical: spacing.m,
    marginHorizontal: spacing.m,
    marginBottom: spacing.m,
    borderRadius: 14,
    ...elevation.raised,
    shadowOpacity: 0.3,
  },
  createNewButtonText: {
    ...typography.body,
    color: 'white',
    fontWeight: '600',
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
    ...elevation.card,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(124,131,253,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.s,
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
