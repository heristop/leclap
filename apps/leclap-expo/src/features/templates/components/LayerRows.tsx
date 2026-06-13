// Background-layer stack for a color scene. Index 0 is the full-bleed base (colour only, pinned);
// extra layers add a hex + opacity + optional gradient {from,to,direction}. Writes the whole
// BackgroundLayer[] up via onChange, which the screen passes to patchLayers.
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/src/styles/theme';
import { Slider, Segmented } from './EditorControls';
import { newBaseLayer, newExtraLayer } from './editorPrimitives';
import type { BackgroundLayer } from '../model/templateEditorModel';

type GradientDir = 'horizontal' | 'vertical' | 'diagonal';

interface LayerRowsProps {
  layers: BackgroundLayer[] | undefined;
  baseColor: string;
  t: TFunction<'editor'>;
  onChange: (layers: BackgroundLayer[]) => void;
}

export const LayerRows = ({ layers, baseColor, t, onChange }: LayerRowsProps) => {
  const list = layers && layers.length > 0 ? layers : [newBaseLayer(baseColor)];

  const update = (index: number, patch: Partial<BackgroundLayer>) => {
    onChange(list.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const remove = (index: number) => {
    onChange(list.filter((_, i) => i !== index));
  };

  return (
    <View>
      <Text style={styles.label}>{t('layers.label')}</Text>
      {list.map((layer, index) => (
        <LayerRow
          key={index}
          layer={layer}
          index={index}
          isBase={index === 0}
          t={t}
          onPatch={(patch) => {
            update(index, patch);
          }}
          onRemove={() => {
            remove(index);
          }}
        />
      ))}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t('layers.add')}
        onPress={() => {
          onChange([...list, newExtraLayer()]);
        }}
        style={styles.addBtn}
      >
        <Ionicons name="add" size={16} color={colors.primary} />
        <Text style={styles.addBtnText}>{t('layers.add')}</Text>
      </TouchableOpacity>
    </View>
  );
};

interface LayerRowProps {
  layer: BackgroundLayer;
  index: number;
  isBase: boolean;
  t: TFunction<'editor'>;
  onPatch: (patch: Partial<BackgroundLayer>) => void;
  onRemove: () => void;
}

const LayerRow = ({ layer, index, isBase, t, onPatch, onRemove }: LayerRowProps) => {
  const gradient = layer.gradient;

  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowTitle}>{isBase ? t('layers.base') : t('layers.layerN', { n: index + 1 })}</Text>
        {isBase ? null : (
          <TouchableOpacity
            onPress={onRemove}
            accessibilityLabel={t('layers.remove', { n: index + 1 })}
            style={styles.iconBtn}
          >
            <Ionicons name="trash-outline" size={18} color={colors.error} />
          </TouchableOpacity>
        )}
      </View>

      {gradient ? null : (
        <View style={styles.colorRow}>
          <View style={[styles.swatch, { backgroundColor: layer.color ?? '#000000' }]} />
          <TextInput
            style={styles.input}
            value={layer.color ?? '#000000'}
            autoCapitalize="none"
            onChangeText={(color) => {
              onPatch({ color });
            }}
            placeholder="#000000"
            placeholderTextColor={colors.textSecondary}
          />
        </View>
      )}

      <Slider
        label={t('layers.opacity')}
        value={layer.opacity ?? 1}
        min={0}
        max={1}
        step={0.05}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(opacity) => {
          onPatch({ opacity });
        }}
      />

      <Segmented
        label={t('layers.fill')}
        value={gradient ? 'gradient' : 'solid'}
        options={[
          { value: 'solid', label: t('layers.solid') },
          { value: 'gradient', label: t('layers.gradient') },
        ]}
        onChange={(v) => {
          const next =
            v === 'gradient'
              ? { from: layer.color ?? '#7C83FD', to: '#000000', direction: 'vertical' as const }
              : undefined;
          onPatch({ gradient: next });
        }}
      />

      {gradient ? (
        <View>
          <View style={styles.colorRow}>
            <View style={[styles.swatch, { backgroundColor: gradient.from }]} />
            <TextInput
              style={styles.input}
              value={gradient.from}
              autoCapitalize="none"
              onChangeText={(from) => {
                onPatch({ gradient: { ...gradient, from } });
              }}
              placeholder="#7C83FD"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <View style={styles.colorRow}>
            <View style={[styles.swatch, { backgroundColor: gradient.to }]} />
            <TextInput
              style={styles.input}
              value={gradient.to}
              autoCapitalize="none"
              onChangeText={(to) => {
                onPatch({ gradient: { ...gradient, to } });
              }}
              placeholder="#000000"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <Segmented<GradientDir>
            label={t('layers.direction')}
            value={gradient.direction ?? 'vertical'}
            options={[
              { value: 'vertical', label: t('layers.vertical') },
              { value: 'horizontal', label: t('layers.horizontal') },
              { value: 'diagonal', label: t('layers.diagonal') },
            ]}
            onChange={(direction) => {
              onPatch({ gradient: { ...gradient, direction } });
            }}
          />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    ...typography.smallText,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.m,
    marginBottom: spacing.xs,
  },
  row: {
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.s,
    marginBottom: spacing.s,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTitle: { ...typography.caption, color: colors.text, fontWeight: '600' },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginTop: spacing.s },
  swatch: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: colors.divider },
  input: {
    ...typography.body,
    fontSize: 14,
    flex: 1,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: spacing.s,
    paddingVertical: 8,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: spacing.m,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: 'rgba(124,131,253,0.08)',
  },
  addBtnText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
});
