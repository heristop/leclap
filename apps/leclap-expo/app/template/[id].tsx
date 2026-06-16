import React from 'react';
import { View, StyleSheet } from 'react-native';
import TemplateDetailScreen from '@/src/features/templates/screens/TemplateDetailScreen';
import { colors } from '@/src/styles/theme';

export default function TemplateDetailPage() {
  // TemplateDetailScreen will read params directly using useLocalSearchParams
  // This includes both 'id' (templateName) and 'projectId' when available

  return (
    <View style={styles.container}>
      <TemplateDetailScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
