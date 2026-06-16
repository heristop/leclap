import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '@/src/styles/theme';
import { styles } from './previewStyles';

function ToolButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.toolButton} onPress={onPress} activeOpacity={0.8}>
      <Ionicons name={icon} size={24} color={active ? colors.accent : colors.surface} />
      <Text style={[styles.toolButtonText, active && { color: colors.accent }]}>{label}</Text>
    </TouchableOpacity>
  );
}

interface PreviewToolbarProps {
  saving: boolean;
  canEdit: boolean;
  trimActive: boolean;
  cropActive: boolean;
  onDone: () => void;
  onTrim: () => void;
  onCrop: () => void;
  onRetake: () => void;
}

/** View-mode chrome: the save/close button and the bottom Trim / Crop / Retake toolbar. */
export function PreviewToolbar({
  saving,
  canEdit,
  trimActive,
  cropActive,
  onDone,
  onTrim,
  onCrop,
  onRetake,
}: PreviewToolbarProps) {
  const { t } = useTranslation('preview');

  return (
    <>
      <TouchableOpacity
        style={styles.closeButton}
        onPress={onDone}
        activeOpacity={0.7}
        disabled={saving}
        accessibilityLabel={t('toolbar.saveAndClose')}
      >
        {saving ? <ActivityIndicator color="#000" /> : <Ionicons name="checkmark" size={32} color="#000" />}
      </TouchableOpacity>

      <View style={styles.toolbar}>
        {canEdit && <ToolButton icon="cut-outline" label={t('toolbar.trim')} active={trimActive} onPress={onTrim} />}
        {canEdit && <ToolButton icon="crop-outline" label={t('toolbar.crop')} active={cropActive} onPress={onCrop} />}
        <ToolButton icon="refresh" label={t('toolbar.retake')} onPress={onRetake} />
      </View>
    </>
  );
}
