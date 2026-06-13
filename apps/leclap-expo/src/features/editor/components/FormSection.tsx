import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, typography } from '@/src/styles/theme';
import type { Section } from '@/src/types';

interface FormSectionProps {
  section: Section;
  formData: Record<string, string>;
  onFormDataChange: (field: string, value: string) => void;
}

const FormSection: React.FC<FormSectionProps> = ({ section, formData, onFormDataChange }) => {
  const { t } = useTranslation('editor');
  const fields = section.options?.fields ?? [];

  // Track screen orientation
  const [isLandscape, setIsLandscape] = useState(Dimensions.get('window').width > Dimensions.get('window').height);

  // Update orientation when dimensions change
  useEffect(() => {
    const updateOrientation = () => {
      setIsLandscape(Dimensions.get('window').width > Dimensions.get('window').height);
    };

    // Listen for dimension changes
    Dimensions.addEventListener('change', updateOrientation);

    return () => {};
  }, []);

  return (
    <ScrollView style={styles.container}>
      {section.description?.en && (
        <View style={[styles.descriptionContainer, isLandscape && styles.landscapeDescription]}>
          <Text style={styles.description}>{section.description.en}</Text>
        </View>
      )}

      <View style={isLandscape ? styles.landscapeFieldsContainer : styles.fieldsContainer}>
        {fields.map((field) => (
          <View key={field.name} style={[styles.fieldContainer, isLandscape && styles.landscapeFieldContainer]}>
            <Text style={styles.label}>{field.label.en}</Text>

            {/* Field description */}
            {field.description?.en && <Text style={styles.fieldDescription}>{field.description.en}</Text>}

            <TextInput
              style={[styles.input, isLandscape && field.maxLength > 100 && styles.landscapeTextarea]}
              value={formData[field.name] || ''}
              onChangeText={(text) => {
                onFormDataChange(field.name, text);
              }}
              maxLength={field.maxLength || 100}
              placeholder={t('enterField', { label: field.label.en })}
              multiline={field.maxLength > 100}
            />
            {field.maxLength && (
              <Text style={styles.counter}>
                {formData[field.name]?.length || 0}/{field.maxLength}
              </Text>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.m,
    flex: 1,
  },
  descriptionContainer: {
    padding: spacing.m,
    marginBottom: spacing.m,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 8,
  },
  description: {
    ...typography.body,
  },
  landscapeDescription: {
    width: '100%',
  },
  fieldContainer: {
    marginBottom: spacing.l,
  },
  fieldsContainer: {
    flexDirection: 'column',
  },
  label: {
    ...typography.body,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  fieldDescription: {
    ...typography.caption,
    marginBottom: spacing.m,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 8,
    padding: spacing.m,
    fontSize: 16,
    minHeight: 50,
  },
  counter: {
    ...typography.caption,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  landscapeFieldsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  landscapeFieldContainer: {
    width: '48%',
  },
  landscapeTextarea: {
    height: 150,
  },
});

export default FormSection;
