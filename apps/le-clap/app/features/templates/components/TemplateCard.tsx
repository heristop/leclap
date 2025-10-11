import React from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Template } from '@/app/types';
import { colors, spacing, typography } from '@/app/styles/theme';

interface TemplateCardProps {
  template: Template;
  onPress: (template: Template) => void;
}

const TemplateCard: React.FC<TemplateCardProps> = ({ 
  template, 
  onPress,
}) => {
  const orientation = template.content.global?.orientation || 'portrait';
  const templateName = template.name.replace('.json', '');
  
  // Try to find a description from the first section
  const description = template.content.sections?.find(section => 
    section.description?.en
  )?.description?.en || 'Create a video using this template';
  
  return (
    <Pressable
      style={styles.card}
      onPress={() => onPress(template)}
    >
      <Image
        source={{ uri: `http://localhost:3000/serve/${templateName}-thumbnail.jpg` }}
        style={styles.thumbnail}
        resizeMode="cover"
        defaultSource={require('@/assets/images/icon.png')}
      />
      
      <View style={styles.orientationBadge}>
        <Ionicons 
          name={orientation === 'portrait' ? 'phone-portrait-outline' : 'phone-landscape-outline'} 
          size={16} 
          color="white" 
        />
      </View>
      
      <View style={styles.infoContainer}>
        <Text style={styles.title}>{templateName}</Text>
        <Text style={styles.description} numberOfLines={2}>
          {description}
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    overflow: 'hidden',
    margin: spacing.s,
    width: '45%',
  },
  thumbnail: {
    width: '100%',
    height: 160,
    backgroundColor: colors.divider,
  },
  infoContainer: {
    padding: spacing.m,
  },
  title: {
    ...typography.subtitle,
    marginBottom: spacing.xs,
  },
  description: {
    ...typography.caption,
  },
  orientationBadge: {
    position: 'absolute',
    top: spacing.s,
    right: spacing.s,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.xs,
    borderRadius: 16,
  },
});

export default TemplateCard;
