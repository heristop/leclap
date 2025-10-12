import React, { useState } from 'react';
import { FlatList, StyleSheet, View, TextInput, RefreshControl, Text } from 'react-native';
import { Template } from '@/app/types';
import TemplateCard from './TemplateCard';
import { colors, spacing, typography } from '@/app/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface TemplateListProps {
  templates: Template[];
  onSelectTemplate: (template: Template) => void;
  isOffline?: boolean;
  onRefresh?: () => Promise<void> | void;
  screenTitle?: string;
  subtitle?: string;
}

const TemplateList: React.FC<TemplateListProps> = ({
  templates,
  onSelectTemplate,
  isOffline = false,
  onRefresh,
  screenTitle,
  subtitle,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  
  const filteredTemplates = templates.filter(template => {
    const searchTerms = searchQuery.toLowerCase();
    
    // Search in template name
    if (template.name.toLowerCase().includes(searchTerms)) {
      return true;
    }
    
    // Search in section titles and descriptions
    if (template.content.sections?.some(section => 
      (section.title?.en?.toLowerCase() || '').includes(searchTerms) ||
      (section.description?.en?.toLowerCase() || '').includes(searchTerms)
    )) {
      return true;
    }
    
    return false;
  });

  const handleRefresh = async () => {
    if (isOffline) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    if (!onRefresh) return;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRefreshing(true);

    try {
      await onRefresh();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setRefreshing(false);
    }
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {screenTitle && <Text style={styles.screenTitle}>{screenTitle}</Text>}
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search templates..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Ionicons
            name="close-circle"
            size={20}
            color={colors.textSecondary}
            style={styles.clearIcon}
            onPress={() => setSearchQuery('')}
          />
        )}
      </View>
    </View>
  );

  return (
    <FlatList
      data={filteredTemplates}
      renderItem={({ item, index }) => (
        <TemplateCard
          template={item}
          onPress={onSelectTemplate}
          index={index}
        />
      )}
      keyExtractor={(item) => item.name}
      numColumns={2}
      contentContainerStyle={styles.list}
      ListHeaderComponent={renderHeader}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            title={isOffline ? "Pull to sync when online" : "Pull to refresh"}
            titleColor={colors.textSecondary}
            colors={[colors.primary]}
          />
        ) : undefined
      }
    />
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    paddingTop: spacing.s,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing.m,
    paddingHorizontal: spacing.m,
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  searchIcon: {
    marginRight: spacing.s,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.m,
  },
  clearIcon: {
    marginLeft: spacing.s,
  },
  list: {
    padding: spacing.s,
  },
});

export default TemplateList;
