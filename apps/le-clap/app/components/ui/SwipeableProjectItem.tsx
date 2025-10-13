import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  Alert,
  Image,
 ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/src/styles/theme';
import { Project } from '@/src/types';
import ConfirmDialog from './dialog/ConfirmDialog';
import * as Haptics from 'expo-haptics';

interface SwipeableProjectItemProps {
  project: Project;
  onPress: () => void;
  onDelete: () => Promise<void>;
}

const SWIPE_THRESHOLD = 80;

const SwipeableProjectItem = React.memo(function SwipeableProjectItem({
  project,
  onPress,
  onDelete,
}: SwipeableProjectItemProps) {
  const [isPressed, setIsPressed] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const pan = useRef(new Animated.ValueXY()).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 5;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: 0,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x }], {
        useNativeDriver: true,
      }),
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();
        if (gestureState.dx < -SWIPE_THRESHOLD) {
          // Swiped left (delete)
          Animated.timing(pan, {
            toValue: { x: -SWIPE_THRESHOLD, y: 0 },
            duration: 200,
            useNativeDriver: true,
          }).start();
        } else {
          // Reset position
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            friction: 5,
            tension: 40,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const handlePressIn = () => {
    setIsPressed(true);
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    setIsPressed(false);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const handleDeletePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowDialog(true);
  };

  interface HandleDeleteButtonPressEvent {
    stopPropagation: () => void;
  }

  const handleDeleteButtonPress = (e: HandleDeleteButtonPressEvent) => {
    e.stopPropagation();
    handleDeletePress();
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    setShowDialog(false);
    try {
      await onDelete();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error deleting project:', error);
      Alert.alert('Error', 'Failed to delete the project. Please try again.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsDeleting(false);

      // Reset animation
      Animated.spring(pan, {
        toValue: { x: 0, y: 0 },
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }).start();
    }
  };

  // Calculate background position for the delete button
  const deleteButtonTranslateX = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [0, SWIPE_THRESHOLD],
    extrapolate: 'clamp',
  });

  // Status colors and icons
  const getStatusColor = () => {
    switch (project.status) {
      case 'completed':
        return colors.success;
      case 'processing':
        return colors.warning;
      default:
        return colors.primary;
    }
  };

  const getStatusIcon = () => {
    switch (project.status) {
      case 'completed':
        return 'checkmark-circle';
      case 'processing':
        return 'time';
      default:
        return 'document-text';
    }
  };

  return (
    <View style={styles.container}>
      {/* Delete button - positioned under the item */}
      <Animated.View
        style={[
          styles.deleteButton,
          {
            transform: [{ translateX: deleteButtonTranslateX }],
          },
        ]}
      >
        <TouchableOpacity 
          style={styles.deleteButtonTouchable} 
          onPress={handleDeletePress}
          disabled={isDeleting} // Disable button while deleting
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color="white" /> // Show loading indicator
          ) : (
            <>
              <Ionicons name="trash" size={24} color="white" />
              <Text style={styles.deleteText}>Delete</Text>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Item content - swipeable */}
      <Animated.View
        style={[
          styles.itemContainer,
          {
            transform: [
              { translateX: pan.x },
              { scale: scaleAnim }
            ],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity 
          activeOpacity={0.9} 
          onPress={onPress} 
          style={styles.touchable}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <View style={styles.content}>
            {/* Display thumbnail if available, otherwise display status icon */}
            {project.thumbnailUri ? (
              <Image source={{ uri: project.thumbnailUri }} style={styles.thumbnail} />
            ) : (
              <View style={[styles.statusIcon, { backgroundColor: getStatusColor() + '20', borderColor: getStatusColor() }]}>
                <Ionicons name={getStatusIcon()} size={24} color={getStatusColor()} />
              </View>
            )}
            <View style={styles.textContainer}>
              <Text style={styles.title} numberOfLines={1}>{project.name}</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {project.status === 'completed' 
                  ? 'Ready to view' 
                  : project.status === 'processing' 
                    ? 'Processing...' 
                    : 'Continue editing'}
              </Text>
              <View style={styles.dateContainer}>
              <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.date}>
              {new Date(project.updatedAt).toLocaleDateString()}
              </Text>
              </View>
              </View>
              <View style={styles.actions}>
              <TouchableOpacity
                  style={styles.actionButton}
              onPress={handleDeleteButtonPress}
            >
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            </TouchableOpacity>
            <View style={styles.chevron}>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </View>
          </View>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        visible={showDialog}
        title="Delete Project"
        message={`Are you sure you want to delete "${project.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        confirmIconName="trash"
        confirmType="danger"
        onConfirm={confirmDelete}
        onCancel={() => setShowDialog(false)}
      />
    </View>
  );
});

export default SwipeableProjectItem;

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  itemContainer: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    zIndex: 1,
    marginHorizontal: spacing.m,
    marginBottom: spacing.m,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: spacing.m,
    backgroundColor: colors.divider,
    resizeMode: 'cover',
  },
  touchable: {
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.m,
  },
  statusIcon: {
    width: 60, 
    height: 60,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.m,
    borderWidth: 1.5,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    ...typography.subtitle,
    fontSize: 16,
  },
  subtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  date: {
    ...typography.smallText,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  chevron: {
    marginLeft: spacing.s,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: spacing.s,
    marginHorizontal: spacing.xs,
  },
  deleteButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: SWIPE_THRESHOLD,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  deleteButtonTouchable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteText: {
    ...typography.button,
    color: colors.surface,
    marginTop: 4,
    fontSize: 12,
  },
});
