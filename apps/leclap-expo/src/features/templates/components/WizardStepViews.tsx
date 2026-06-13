// The Info and Scenes wizard-step views, split out of the create-template screen to keep it small.
// They take typed callbacks and never mutate EditorState — the screen applies edits through the
// shared pure ops. The Style & Audio step lives in StyleAudioStep.tsx.
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/src/styles/theme';
import { SceneCard } from './SceneCard';
import { lastVisualIndex } from './wizardSteps';
import {
  defaultCountdownFor,
  SECTION_LABELS,
  SECTION_KINDS,
  type EditorSection,
  type EditorState,
  type BackgroundLayer,
} from '../model/templateEditorModel';

type VideoSection = Extract<EditorSection, { kind: 'video' }>;

const KIND_ICON: Record<EditorSection['kind'], keyof typeof Ionicons.glyphMap> = {
  video: 'videocam',
  form: 'text',
  color: 'color-palette',
  music: 'musical-notes',
  image: 'image-outline',
};

interface InfoStepProps {
  state: EditorState;
  t: TFunction<'editor'>;
  onPatch: (p: Partial<EditorState>) => void;
}

export const InfoStep = ({ state, t, onPatch }: InfoStepProps) => (
  <View>
    <Text style={styles.label}>{t('name.label')}</Text>
    <TextInput
      testID="tpl-name"
      style={styles.input}
      value={state.name}
      onChangeText={(name) => {
        onPatch({ name });
      }}
      placeholder={t('name.placeholder')}
      placeholderTextColor={colors.textSecondary}
    />

    <Text style={[styles.label, { marginTop: spacing.l }]}>{t('orientation.label')}</Text>
    <View style={styles.segment}>
      {(['landscape', 'portrait'] as const).map((o) => (
        <TouchableOpacity
          key={o}
          testID={`orient-${o}`}
          onPress={() => {
            onPatch({ orientation: o });
          }}
          style={[styles.segmentItem, state.orientation === o && styles.segmentItemActive]}
          accessibilityRole="radio"
          accessibilityState={{ selected: state.orientation === o }}
        >
          <Ionicons
            name={o === 'landscape' ? 'tablet-landscape-outline' : 'phone-portrait-outline'}
            size={16}
            color={state.orientation === o ? '#fff' : colors.textSecondary}
          />
          <Text style={[styles.segmentText, state.orientation === o && styles.segmentTextActive]}>
            {o === 'landscape' ? t('orientation.landscape') : t('orientation.portrait')}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  </View>
);

interface ScenesStepProps {
  state: EditorState;
  t: TFunction<'editor'>;
  onPatchSection: (i: number, p: Partial<EditorSection>) => void;
  onLayers: (i: number, layers: BackgroundLayer[]) => void;
  onRemove: (i: number) => void;
  onDuplicate: (i: number) => void;
  onMove: (i: number, dir: -1 | 1) => void;
  onAdd: (kind: EditorSection['kind']) => void;
  onOpenTransition: (i: number) => void;
  onEditOverlay: (i: number) => void;
}

export const ScenesStep = (props: ScenesStepProps) => {
  const { state, t, onPatchSection, onLayers, onRemove, onDuplicate, onMove, onAdd, onOpenTransition, onEditOverlay } =
    props;
  const lastVisual = lastVisualIndex(state);

  return (
    <View>
      {state.sections.map((section, i) => (
        <View key={i}>
          <SceneCard
            index={i}
            count={state.sections.length}
            section={section}
            t={t}
            defaultCountdownSeconds={defaultCountdownFor}
            onChange={(p) => {
              onPatchSection(i, p);
            }}
            onLayers={(layers) => {
              onLayers(i, layers);
            }}
            onRemove={() => {
              onRemove(i);
            }}
            onDuplicate={() => {
              onDuplicate(i);
            }}
            onMove={(dir) => {
              onMove(i, dir);
            }}
            onEditOverlay={() => {
              onEditOverlay(i);
            }}
          />
          {section.kind !== 'music' && i !== lastVisual ? (
            <TransitionConnector
              section={section}
              t={t}
              onPress={() => {
                onOpenTransition(i);
              }}
            />
          ) : null}
        </View>
      ))}

      <Text style={[styles.label, { marginTop: spacing.l }]}>{t('scenes.add')}</Text>
      <View style={styles.addRow}>
        {SECTION_KINDS.map((kind) => (
          <TouchableOpacity
            key={kind}
            testID={`add-${kind}`}
            onPress={() => {
              onAdd(kind);
            }}
            style={styles.addBtn}
          >
            <Ionicons name={KIND_ICON[kind]} size={16} color={colors.primary} />
            <Text style={styles.addBtnText}>{SECTION_LABELS[kind]}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

interface TransitionConnectorProps {
  section: EditorSection;
  t: TFunction<'editor'>;
  onPress: () => void;
}

// The tappable boundary between two scenes; shows the current transition (or "Cut").
const TransitionConnector = ({ section, t, onPress }: TransitionConnectorProps) => {
  const transition = section.kind === 'music' ? undefined : (section as VideoSection).transitionAfter;
  const label = transition ? `${transition.type} · ${transition.duration ?? 0.5}s` : t('transition.cut');

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${t('transition.title')}: ${label}`}
      testID="open-transition"
      onPress={onPress}
      style={styles.connector}
    >
      <View style={styles.connectorLine} />
      <View style={styles.connectorChip}>
        <Ionicons name="swap-vertical" size={13} color={colors.primary} />
        <Text style={styles.connectorText}>{label}</Text>
      </View>
      <View style={styles.connectorLine} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  label: {
    ...typography.smallText,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
  },
  segment: { flexDirection: 'row', gap: spacing.s },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  segmentItemActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segmentText: { ...typography.caption, color: colors.textSecondary },
  segmentTextActive: { color: '#fff' },
  addRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s, marginTop: spacing.s },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: spacing.m,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: 'rgba(124,131,253,0.08)',
  },
  addBtnText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  connector: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingVertical: spacing.xs },
  connectorLine: { flex: 1, height: 1, backgroundColor: colors.divider },
  connectorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 32,
    paddingHorizontal: spacing.m,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  connectorText: { ...typography.smallText, color: colors.text, textTransform: 'capitalize' },
});
