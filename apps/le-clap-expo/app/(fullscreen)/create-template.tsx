import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Switch, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Button from '@/app/components/ui/Button';
import { colors, spacing, typography } from '@/src/styles/theme';
import { useUserTemplateStore } from '@/src/stores/useUserTemplateStore';
import { MediaPicker } from '@/app/features/templates/components/MediaPicker';
import {
  buildDescriptor,
  newSection,
  toEditorState,
  SECTION_LABELS,
  SECTION_KINDS,
  type EditorSection,
  type EditorState,
} from '@/app/features/templates/model/templateEditorModel';

const KIND_ICON: Record<EditorSection['kind'], keyof typeof Ionicons.glyphMap> = {
  video: 'videocam',
  form: 'text',
  color: 'color-palette',
  music: 'musical-notes',
  image: 'image-outline',
};

// Add `id` if absent, drop it if present — pure shortlist toggle.
const toggleId = (list: string[], id: string): string[] =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

export default function CreateTemplateScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const getById = useUserTemplateStore((s) => s.getById);
  const save = useUserTemplateStore((s) => s.save);

  const [state, setState] = useState<EditorState>(() => {
    const existing = id ? getById(id) : undefined;

    return toEditorState(existing ?? null);
  });

  const patch = (p: Partial<EditorState>) => {
    setState((s) => ({ ...s, ...p }));
  };

  const patchSection = (i: number, p: Partial<EditorSection>) => {
    setState((s) => ({
      ...s,
      sections: s.sections.map((sec, idx) => (idx === i ? ({ ...sec, ...p } as EditorSection) : sec)),
    }));
  };

  const addSection = (kind: EditorSection['kind']) => {
    Haptics.selectionAsync().catch(() => {});
    setState((s) => ({ ...s, sections: [...s.sections, newSection(kind)] }));
  };

  const removeSection = (i: number) => {
    setState((s) => ({ ...s, sections: s.sections.filter((_, idx) => idx !== i) }));
  };

  const move = (i: number, dir: -1 | 1) => {
    const to = i + dir;
    setState((s) => {
      if (to < 0 || to >= s.sections.length) {
        return s;
      }
      const next = [...s.sections];
      const [m] = next.splice(i, 1);
      next.splice(to, 0, m);

      return { ...s, sections: next };
    });
    Haptics.selectionAsync().catch(() => {});
  };

  const onSave = () => {
    if (state.name.trim() === '') {
      Alert.alert('Name required', 'Give your template a name.');

      return;
    }

    if (state.sections.length === 0) {
      Alert.alert('Add a section', 'A template needs at least one section.');

      return;
    }

    save({
      id: state.id,
      name: state.name.trim(),
      description: state.description.trim(),
      orientation: state.orientation,
      descriptor: buildDescriptor(state),
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          testID="close-editor"
          onPress={() => {
            router.back();
          }}
          style={styles.iconBtn}
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{id ? 'Edit template' : 'Create a template'}</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Name</Text>
        <TextInput
          testID="tpl-name"
          style={styles.input}
          value={state.name}
          onChangeText={(name) => {
            patch({ name });
          }}
          placeholder="My template"
          placeholderTextColor={colors.textSecondary}
        />

        <Text style={styles.label}>Orientation</Text>
        <View style={styles.segment}>
          {(['landscape', 'portrait'] as const).map((o) => (
            <TouchableOpacity
              key={o}
              testID={`orient-${o}`}
              onPress={() => {
                patch({ orientation: o });
              }}
              style={[styles.segmentItem, state.orientation === o && styles.segmentItemActive]}
            >
              <Ionicons
                name={o === 'landscape' ? 'tablet-landscape-outline' : 'phone-portrait-outline'}
                size={16}
                color={state.orientation === o ? '#fff' : colors.textSecondary}
              />
              <Text style={[styles.segmentText, state.orientation === o && styles.segmentTextActive]}>
                {o === 'landscape' ? 'Landscape 16:9' : 'Portrait 9:16'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { marginTop: spacing.l }]}>Sections — order top to bottom</Text>
        {state.sections.map((section, i) => (
          <SectionCard
            key={i}
            index={i}
            count={state.sections.length}
            section={section}
            onChange={(p) => {
              patchSection(i, p);
            }}
            onRemove={() => {
              removeSection(i);
            }}
            onMove={(dir) => {
              move(i, dir);
            }}
          />
        ))}

        <View style={styles.addRow}>
          {SECTION_KINDS.map((kind) => (
            <TouchableOpacity
              key={kind}
              testID={`add-${kind}`}
              onPress={() => {
                addSection(kind);
              }}
              style={styles.addBtn}
            >
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={styles.addBtnText}>{SECTION_LABELS[kind]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: spacing.l }} />
        <View testID="save-template">
          <Button variant="primary" size="large" icon="save" fullWidth onPress={onSave}>
            Save template
          </Button>
        </View>
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

interface SectionCardProps {
  index: number;
  count: number;
  section: EditorSection;
  onChange: (p: Partial<EditorSection>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}

const SectionCard = ({ index, count, section, onChange, onRemove, onMove }: SectionCardProps) => (
  <View testID={`section-${index}`} style={styles.card}>
    <View style={styles.cardHeader}>
      <View style={styles.cardTitle}>
        <Ionicons name={KIND_ICON[section.kind]} size={18} color={colors.primary} />
        <Text style={styles.cardTitleText}>{SECTION_LABELS[section.kind]}</Text>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity
          testID={`section-${index}-up`}
          disabled={index === 0}
          onPress={() => {
            onMove(-1);
          }}
          style={styles.iconBtnSm}
        >
          <Ionicons name="chevron-up" size={18} color={index === 0 ? colors.divider : colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          testID={`section-${index}-down`}
          disabled={index === count - 1}
          onPress={() => {
            onMove(1);
          }}
          style={styles.iconBtnSm}
        >
          <Ionicons name="chevron-down" size={18} color={index === count - 1 ? colors.divider : colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity testID={`section-${index}-remove`} onPress={onRemove} style={styles.iconBtnSm}>
          <Ionicons name="trash-outline" size={18} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>

    {section.kind === 'video' && (
      <View>
        <FieldRow label="Duration (s)">
          <NumberInput
            value={section.duration}
            onChange={(duration) => {
              onChange({ duration });
            }}
          />
        </FieldRow>
        <View style={styles.rowBetween}>
          <Text style={styles.fieldLabel}>Mute audio</Text>
          <Switch
            value={section.mute}
            onValueChange={(mute) => {
              onChange({ mute });
            }}
            trackColor={{ true: colors.primary, false: colors.divider }}
            thumbColor="#fff"
          />
        </View>
        <FieldRow label="Overlay text (optional)">
          <TextInput
            style={styles.inputSm}
            value={section.text}
            onChangeText={(text) => {
              onChange({ text });
            }}
            placeholder="supports {{ firstname }}"
            placeholderTextColor={colors.textSecondary}
          />
        </FieldRow>
      </View>
    )}

    {section.kind === 'color' && (
      <View>
        <FieldRow label="Duration (s)">
          <NumberInput
            value={section.duration}
            onChange={(duration) => {
              onChange({ duration });
            }}
          />
        </FieldRow>
        <FieldRow label="Color (hex)">
          <View style={styles.colorRow}>
            <View style={[styles.swatch, { backgroundColor: section.color }]} />
            <TextInput
              style={styles.inputSm}
              value={section.color}
              autoCapitalize="none"
              onChangeText={(color) => {
                onChange({ color });
              }}
              placeholder="#7C83FD"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
        </FieldRow>
      </View>
    )}

    {section.kind === 'form' && (
      <View>
        {section.fields.map((f, fi) => (
          <FieldRow key={fi} label={`Field ${fi + 1} label`}>
            <View style={styles.colorRow}>
              <TextInput
                style={[styles.inputSm, { flex: 1 }]}
                value={f.label}
                onChangeText={(label) => {
                  const fields = section.fields.map((x, idx) => (idx === fi ? { ...x, label } : x));
                  onChange({ fields });
                }}
                placeholder="Your name"
                placeholderTextColor={colors.textSecondary}
              />
              {section.fields.length > 1 && (
                <TouchableOpacity
                  onPress={() => {
                    onChange({ fields: section.fields.filter((_, idx) => idx !== fi) });
                  }}
                  style={styles.iconBtnSm}
                >
                  <Ionicons name="close" size={16} color={colors.error} />
                </TouchableOpacity>
              )}
            </View>
          </FieldRow>
        ))}
        <TouchableOpacity
          onPress={() => {
            onChange({
              fields: [...section.fields, { name: `field_${section.fields.length + 1}`, label: '', maxLength: 40 }],
            });
          }}
          style={[styles.addBtn, { alignSelf: 'flex-start', marginTop: spacing.s }]}
        >
          <Ionicons name="add" size={14} color={colors.primary} />
          <Text style={styles.addBtnText}>Add field</Text>
        </TouchableOpacity>
      </View>
    )}

    {section.kind === 'music' && (
      <View>
        <Text style={styles.fieldLabel}>Pick the tracks viewers can choose from.</Text>
        <MediaPicker
          kind="music"
          selectedIds={section.allowed}
          onToggleId={(id) => {
            onChange({ allowed: toggleId(section.allowed, id) });
          }}
        />
        <View style={styles.rowBetween}>
          <Text style={styles.fieldLabel}>Allow viewers to upload their own track</Text>
          <Switch
            testID={`section-${index}-allow-upload`}
            value={section.allowUpload}
            onValueChange={(allowUpload) => {
              onChange({ allowUpload });
            }}
            trackColor={{ true: colors.primary, false: colors.divider }}
            thumbColor="#fff"
          />
        </View>
      </View>
    )}

    {section.kind === 'image' && (
      <View>
        <FieldRow label="Duration (s)">
          <NumberInput
            value={section.duration}
            onChange={(duration) => {
              onChange({ duration });
            }}
          />
        </FieldRow>
        <Text style={styles.fieldLabel}>Pick the images viewers can choose from.</Text>
        <MediaPicker
          kind="picture"
          selectedIds={section.allowed}
          onToggleId={(id) => {
            onChange({ allowed: toggleId(section.allowed, id) });
          }}
        />
        <View style={styles.rowBetween}>
          <Text style={styles.fieldLabel}>Allow viewers to upload their own image</Text>
          <Switch
            testID={`section-${index}-allow-upload`}
            value={section.allowUpload}
            onValueChange={(allowUpload) => {
              onChange({ allowUpload });
            }}
            trackColor={{ true: colors.primary, false: colors.divider }}
            thumbColor="#fff"
          />
        </View>
      </View>
    )}
  </View>
);

const FieldRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <View style={{ marginTop: spacing.s }}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {children}
  </View>
);

const NumberInput = ({ value, onChange }: { value: number; onChange: (n: number) => void }) => (
  <TextInput
    style={styles.inputSm}
    value={String(value)}
    keyboardType="number-pad"
    onChangeText={(t) => {
      const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
      onChange(Number.isNaN(n) ? 0 : n);
    }}
  />
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.m,
    paddingTop: spacing.xl,
    paddingBottom: spacing.s,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerTitle: { ...typography.subtitle, color: colors.text },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  iconBtnSm: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.m },
  label: {
    ...typography.smallText,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    marginTop: spacing.m,
  },
  fieldLabel: { ...typography.smallText, color: colors.textSecondary, marginBottom: spacing.xs },
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
  inputSm: {
    ...typography.body,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: spacing.s,
    paddingVertical: 6,
  },
  segment: { flexDirection: 'row', gap: spacing.s },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.s,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  segmentItemActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segmentText: { ...typography.caption, color: colors.textSecondary },
  segmentTextActive: { color: '#fff' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.m },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.m,
    marginTop: spacing.s,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  cardTitleText: { ...typography.button, color: colors.text },
  cardActions: { flexDirection: 'row', alignItems: 'center' },
  addRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s, marginTop: spacing.m },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: 'rgba(124,131,253,0.08)',
  },
  addBtnText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  swatch: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: colors.divider },
});
