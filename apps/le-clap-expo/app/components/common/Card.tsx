import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '@/src/styles/theme';

interface CardProps {
  title: string;
  description?: string;
  iconName?: string;
  status?: 'completed' | 'in-progress' | 'new';
  imageUri?: string;
  onPress: () => void;
  accentColor?: string;
}

const Card = ({
  title,
  description,
  iconName = 'document-text',
  status,
  imageUri,
  onPress,
  accentColor = colors.accent,
}: CardProps) => {
  // Determine icon based on status
  let statusIcon = iconName;
  let statusColor = colors.primary;
  let statusText = '';

  if (status === 'completed') {
    statusIcon = 'checkmark-circle';
    statusColor = colors.success;
    statusText = 'Completed';
  }

  if (status === 'in-progress') {
    statusIcon = 'time';
    statusColor = colors.warning;
    statusText = 'In Progress';
  }

  if (status === 'new') {
    statusIcon = 'star';
    statusColor = colors.accent;
    statusText = 'New';
  }

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {imageUri ? (
        <ImageBackground source={{ uri: imageUri }} style={styles.cardImageContainer} imageStyle={{ opacity: 0.8 }}>
          <View style={[styles.overlay, { backgroundColor: `${colors.primary}80` }]} />
          <View style={[styles.cardImage, { borderColor: accentColor }]}>
            <Ionicons name={statusIcon as keyof typeof Ionicons.glyphMap} size={32} color={statusColor} />
          </View>

          {/* Add gradient overlay for better text readability */}
          <View style={styles.gradientOverlay} />

          <View style={styles.imageTextContainer}>
            <Text style={styles.imageTitle} numberOfLines={1}>
              {title}
            </Text>
          </View>
        </ImageBackground>
      ) : (
        <View style={[styles.cardImageContainer, { backgroundColor: `${colors.primary}15` }]}>
          <View style={[styles.cardImage, { borderColor: accentColor }]}>
            <Ionicons name={statusIcon as keyof typeof Ionicons.glyphMap} size={32} color={statusColor} />
          </View>
        </View>
      )}

      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {title}
        </Text>
        {description && (
          <Text style={styles.cardDescription} numberOfLines={2}>
            {description}
          </Text>
        )}
      </View>

      {status && (
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: `${statusColor}20`,
              borderColor: `${statusColor}40`,
            },
          ]}
        >
          <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
        </View>
      )}

      <View style={[styles.cardBorder, { backgroundColor: accentColor }]} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginBottom: spacing.m,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  cardImageContainer: {
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
  },
  cardImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 1,
  },
  cardContent: {
    padding: spacing.m,
  },
  cardTitle: {
    ...typography.subtitle,
    marginBottom: spacing.xs,
  },
  cardDescription: {
    ...typography.caption,
  },
  statusBadge: {
    position: 'absolute',
    top: spacing.m,
    right: spacing.m,
    backgroundColor: colors.primary + '20',
    borderRadius: 12,
    paddingHorizontal: spacing.s,
    paddingVertical: 4,
    borderWidth: 1,
    zIndex: 2,
  },
  statusText: {
    ...typography.smallText,
    fontFamily: typography.button.fontFamily,
  },
  cardBorder: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  imageTextContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.m,
  },
  imageTitle: {
    ...typography.subtitle,
    color: colors.surface,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});

export default Card;
