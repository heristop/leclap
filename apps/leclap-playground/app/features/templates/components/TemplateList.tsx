import React, { useState } from 'react';
import { FlatList, StyleSheet, View, TextInput } from 'react-native';
import { Template } from '@/app/types';
import TemplateCard from './TemplateCard';
import { colors, spacing } from '@/app/styles/theme';
import { Ionicons } from '@expo/vector-icons';

interface TemplateListProps {
  templates: Template[];
  onSelectTemplate: (template: Template) => void;
}

const TemplateList: React.FC<TemplateListProps> = ({
  templates,
  onSelectTemplate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  
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

  return (
    <View style={styles.container}>
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
      
      <FlatList
        data={filteredTemplates}
        renderItem={({ item }) => (
          <TemplateCard
            template={item}
            onPress={onSelectTemplate}
          />
        )}
        keyExtractor={(item) => item.name}
        numColumns={2}
        contentContainerStyle={styles.list}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
