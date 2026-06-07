import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import TrimPanel, { type TrimRange } from '@/app/features/editor/components/TrimPanel';
import { styles } from './previewStyles';

interface TrimEditPanelProps {
  duration: number;
  value: TrimRange;
  currentTime: number;
  onChange: (next: TrimRange) => void;
  onSeek: (seconds: number) => void;
  onCancel: () => void;
  onApply: () => void;
}

/** Bottom panel shown in trim mode. */
export function TrimEditPanel({
  duration,
  value,
  currentTime,
  onChange,
  onSeek,
  onCancel,
  onApply,
}: TrimEditPanelProps) {
  return (
    <View style={styles.editPanel}>
      <Text style={styles.editTitle}>Trim clip</Text>
      <TrimPanel
        duration={duration}
        value={value}
        currentTime={currentTime}
        onChange={onChange}
        onSeek={onSeek}
      />
      <View style={styles.editActions}>
        <TouchableOpacity style={styles.ghostButton} onPress={onCancel} activeOpacity={0.8}>
          <Text style={styles.ghostButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton} onPress={onApply} activeOpacity={0.85}>
          <Text style={styles.primaryButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface CropEditPanelProps {
  onReset: () => void;
  onCancel: () => void;
  onApply: () => void;
}

/** Bottom panel shown in crop mode. */
export function CropEditPanel({ onReset, onCancel, onApply }: CropEditPanelProps) {
  return (
    <View style={styles.editPanel}>
      <Text style={styles.editTitle}>Drag the frame to crop</Text>
      <View style={styles.editActions}>
        <TouchableOpacity style={styles.ghostButton} onPress={onReset} activeOpacity={0.8}>
          <Text style={styles.ghostButtonText}>Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghostButton} onPress={onCancel} activeOpacity={0.8}>
          <Text style={styles.ghostButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton} onPress={onApply} activeOpacity={0.85}>
          <Text style={styles.primaryButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
