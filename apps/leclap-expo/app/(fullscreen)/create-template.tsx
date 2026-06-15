import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import * as Haptics from 'expo-haptics';
import Button from '@/src/components/ui/Button';
import { colors, spacing, typography } from '@/src/styles/theme';
import { useUserTemplateStore, type UserTemplate } from '@/src/stores/useUserTemplateStore';
import { TransitionSheet } from '@/src/features/templates/components/TransitionSheet';
import { OverlayPositioner } from '@/src/features/templates/components/OverlayPositioner';
import { StyleAudioStep } from '@/src/features/templates/components/StyleAudioStep';
import { InfoStep, ScenesStep } from '@/src/features/templates/components/WizardStepViews';
import {
  WIZARD_STEPS,
  STEP_TITLE_KEY,
  STEP_SUBTITLE_KEY,
  saveBlocker,
  isStepValid,
  stepIndex,
  type WizardStep,
} from '@/src/features/templates/components/wizardSteps';
import {
  buildDescriptor,
  newSection,
  newOverlay,
  toEditorState,
  reorderSection,
  duplicateSection,
  setTransitionAfter,
  patchLayers,
  type EditorSection,
  type EditorState,
  type EditableTemplate,
  type TextOverlay,
} from '@/src/features/templates/model/templateEditorModel';
import type { TemplateDescriptor } from '@/src/types';

// The on-device store keeps templates under the app-local descriptor type, while the shared editor
// model speaks the core descriptor type. They are structurally identical for what the editor
// reads/writes; this adapter bridges a stored UserTemplate into the shared EditableTemplate shape.
const toEditable = (template: UserTemplate | undefined): EditableTemplate | null =>
  template ? { ...template, descriptor: template.descriptor as EditableTemplate['descriptor'] } : null;

type VideoSection = Extract<EditorSection, { kind: 'video' }>;

// All wizard state + the pure-op mutators, lifted out of the screen so the component stays small.
// Every section edit flows through the shared pure ops — never mutating EditorState in place.
function useTemplateWizard(t: TFunction<'editor'>) {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const getById = useUserTemplateStore((s) => s.getById);
  const save = useUserTemplateStore((s) => s.save);

  const [state, setState] = useState<EditorState>(() => toEditorState(toEditable(id ? getById(id) : undefined)));
  const [step, setStep] = useState<WizardStep>('info');
  const [transitionIndex, setTransitionIndex] = useState<number | null>(null);
  const [overlayIndex, setOverlayIndex] = useState<number | null>(null);

  const patch = (p: Partial<EditorState>) => {
    setState((s) => ({ ...s, ...p }));
  };

  const patchSection = (i: number, p: Partial<EditorSection>) => {
    setState((s) => ({
      ...s,
      sections: s.sections.map((sec, idx) => (idx === i ? ({ ...sec, ...p } as EditorSection) : sec)),
    }));
  };

  const onSave = () => {
    const blocker = saveBlocker(state);

    if (blocker) {
      setStep(blocker.step);
      Alert.alert(t('alerts.almostThere'), t(blocker.messageKey));

      return;
    }

    save({
      id: state.id,
      name: state.name.trim(),
      description: state.description.trim(),
      orientation: state.orientation,
      descriptor: buildDescriptor(state) as TemplateDescriptor,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.back();
  };

  const goNext = () => {
    if (!isStepValid(step, state)) {
      Alert.alert(t('alerts.almostThere'), step === 'info' ? t('alerts.needName') : t('alerts.needScene'));

      return;
    }

    const nextIndex = stepIndex(step) + 1;

    if (nextIndex >= WIZARD_STEPS.length) {
      onSave();

      return;
    }

    setStep(WIZARD_STEPS[nextIndex]);
  };

  const goBack = () => {
    const prevIndex = stepIndex(step) - 1;

    if (prevIndex < 0) {
      router.back();

      return;
    }

    setStep(WIZARD_STEPS[prevIndex]);
  };

  const openOverlay = (i: number) => {
    const target = state.sections[i];

    if (target.kind === 'video' && target.overlays.length === 0) patchSection(i, { overlays: [newOverlay()] });

    setOverlayIndex(i);
  };

  const transitionSection = transitionIndex === null ? undefined : state.sections[transitionIndex];
  const transitionValue =
    transitionSection && transitionSection.kind !== 'music'
      ? (transitionSection as VideoSection).transitionAfter
      : undefined;
  const overlaySection = overlayIndex === null ? undefined : state.sections[overlayIndex];
  const overlay: TextOverlay | undefined = overlaySection?.kind === 'video' ? overlaySection.overlays[0] : undefined;

  return {
    state,
    setState,
    step,
    patch,
    patchSection,
    transitionIndex,
    setTransitionIndex,
    transitionValue,
    overlaySection,
    overlayIndex,
    setOverlayIndex,
    overlay,
    isLast: stepIndex(step) === WIZARD_STEPS.length - 1,
    goNext,
    goBack,
    openOverlay,
  };
}

export default function CreateTemplateScreen() {
  const { t } = useTranslation('editor');
  const {
    state,
    setState,
    step,
    patch,
    patchSection,
    transitionIndex,
    setTransitionIndex,
    transitionValue,
    overlaySection,
    overlayIndex,
    setOverlayIndex,
    overlay,
    isLast,
    goNext,
    goBack,
    openOverlay,
  } = useTemplateWizard(t);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          testID="close-editor"
          onPress={goBack}
          style={styles.iconBtn}
          accessibilityLabel={t('header.back')}
        >
          <Ionicons name={stepIndex(step) === 0 ? 'close' : 'chevron-back'} size={26} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.dots}>
          {WIZARD_STEPS.map((s, i) => (
            <View key={s} style={[styles.dot, i === stepIndex(step) && styles.dotActive]} />
          ))}
        </View>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.stepTitle}>{t(STEP_TITLE_KEY[step])}</Text>
        <Text style={styles.stepSubtitle}>{t(STEP_SUBTITLE_KEY[step])}</Text>

        {step === 'info' ? <InfoStep state={state} t={t} onPatch={patch} /> : null}

        {step === 'scenes' ? (
          <ScenesStep
            state={state}
            t={t}
            onPatchSection={patchSection}
            onLayers={(i, layers) => {
              setState((s) => patchLayers(s, i, layers));
            }}
            onRemove={(i) => {
              setState((s) => ({ ...s, sections: s.sections.filter((_, idx) => idx !== i) }));
            }}
            onDuplicate={(i) => {
              setState((s) => duplicateSection(s, i));
              Haptics.selectionAsync().catch(() => {});
            }}
            onMove={(i, dir) => {
              setState((s) => reorderSection(s, i, i + dir));
              Haptics.selectionAsync().catch(() => {});
            }}
            onAdd={(kind) => {
              setState((s) => ({ ...s, sections: [...s.sections, newSection(kind)] }));
              Haptics.selectionAsync().catch(() => {});
            }}
            onOpenTransition={setTransitionIndex}
            onEditOverlay={openOverlay}
          />
        ) : null}

        {step === 'style' ? <StyleAudioStep state={state} t={t} onPatch={patch} /> : null}

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      <View style={styles.footer} testID={isLast ? 'save-template' : 'wizard-next'}>
        <Button variant="primary" size="large" icon={isLast ? 'save' : 'arrow-forward'} fullWidth onPress={goNext}>
          {isLast ? t('save') : t('wizard.continue')}
        </Button>
      </View>

      <TransitionSheet
        visible={transitionIndex !== null}
        t={t}
        transition={transitionValue}
        onClose={() => {
          setTransitionIndex(null);
        }}
        onChange={(transition) => {
          if (transitionIndex !== null) setState((s) => setTransitionAfter(s, transitionIndex, transition));
        }}
      />

      <OverlayPositioner
        visible={overlayIndex !== null && overlay !== undefined}
        overlay={overlay}
        orientation={state.orientation}
        variables={state.globalVariables.map((v) => v.name).filter((name) => name.trim() !== '')}
        t={t}
        onClose={() => {
          setOverlayIndex(null);
        }}
        onChange={(next) => {
          if (overlayIndex === null || !overlaySection || overlaySection.kind !== 'video') return;

          const [, ...rest] = overlaySection.overlays;
          patchSection(overlayIndex, { overlays: [next, ...rest] });
        }}
        onRemove={() => {
          if (overlayIndex === null || !overlaySection || overlaySection.kind !== 'video') return;

          patchSection(overlayIndex, { overlays: overlaySection.overlays.slice(1) });
          setOverlayIndex(null);
        }}
      />
    </View>
  );
}

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
  dots: { flexDirection: 'row', gap: spacing.s },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.divider },
  dotActive: { width: 22, backgroundColor: colors.primary },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.m },
  stepTitle: { ...typography.title, color: colors.text },
  stepSubtitle: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.m },
  footer: {
    padding: spacing.m,
    paddingBottom: spacing.l,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },
});
