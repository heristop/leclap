import React, { useState } from 'react';
import { FlatList, StyleSheet, View, TextInput, RefreshControl, Text } from 'react-native';
import type { Template } from '@/src/types';
import TemplateCard from './TemplateCard';
import { colors, spacing, typography, fonts } from '@/src/styles/theme';
import { KineticHeading } from '@/src/components/kinetic/kinetic-heading';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

interface TemplateListProps {
  templates: Template[];
  onSelectTemplate: (template: Template) => void;
  isOffline?: boolean;
  onRefresh?: () => Promise<void> | void;
  kicker?: string;
  screenTitle?: string;
  subtitle?: string;
}

const TemplateList: React.FC<TemplateListProps> = ({
  templates,
  onSelectTemplate,
  isOffline = false,
  onRefresh,
  kicker,
  screenTitle,
  subtitle,
}) => {
  const { t } = useTranslation('templates');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const filteredTemplates = templates.filter((template) => {
    const searchTerms = searchQuery.toLowerCase();

    // Search in template name
    if (template.name.toLowerCase().includes(searchTerms)) {
      return true;
    }

    // Search in section titles and descriptions
    if (
      template.content.sections?.some(
        (section) =>
          (section.title?.en.toLowerCase() ?? '').includes(searchTerms) ||
          (section.description?.en.toLowerCase() ?? '').includes(searchTerms)
      )
    ) {
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
    } catch {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setRefreshing(false);
    }
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
      {screenTitle ? (
        <View style={styles.titleWrap}>
          <KineticHeading text={screenTitle} level="displayM" />
        </View>
      ) : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('search.placeholder')}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Ionicons
            name="close-circle"
            size={20}
            color={colors.textSecondary}
            style={styles.clearIcon}
            onPress={() => {
              setSearchQuery('');
            }}
          />
        )}
      </View>
    </View>
  );

  return (
    <FlatList
      data={filteredTemplates}
      renderItem={({ item }) => <TemplateCard template={item} onPress={onSelectTemplate} />}
      keyExtractor={(item) => item.name}
      numColumns={2}
      contentContainerStyle={styles.list}
      ListHeaderComponent={renderHeader}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              handleRefresh().catch(() => null);
            }}
            tintColor={colors.primary}
            title={isOffline ? t('refresh.syncWhenOnline') : t('refresh.pullToRefresh')}
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
    paddingTop: spacing.m,
  },
  kicker: {
    fontFamily: fonts.poppins.semiBold,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.primary,
    marginHorizontal: spacing.m,
    marginBottom: spacing.xs,
  },
  titleWrap: {
    marginHorizontal: spacing.m,
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
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
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
