import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import TemplateDetailScreen from '../../features/templates/screens/TemplateDetailScreen';
import { colors } from '../../styles/theme';

export default function TemplateDetailPage() {
  const { id } = useLocalSearchParams();
  
  return (
    <View style={styles.container}>
      <TemplateDetailScreen templateId={id} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});