// One scene card in the Scenes step. Renders the kind-specific basics (from sceneFields) inline and
// exposes the advanced panels (look, audio, layers, framing, motion) behind disclosures. Every edit
// goes up via the typed callbacks; the screen applies them through the shared pure ops — this
// component never mutates EditorState.
import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import type { TFunction } from 'i18next';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/styles/theme';
import { LookCarousel } from './LookCarousel';
import { GradeFields } from './GradeFields';
import { CaptionFields } from './CaptionFields';
import { LayerRows } from './LayerRows';
import { FramingGuideRow } from './FramingGuideRow';
import { MotionFields } from './MotionFields';
import { SectionAudioFields } from './SectionAudioFields';
import { Disclosure } from './Disclosure';
import { SceneBasics, IconBtn, sceneStyles } from './sceneFields';
import { isVisualKind } from './wizardSteps';
import { SECTION_LABELS, type EditorSection, type BackgroundLayer } from '../model/templateEditorModel';

const KIND_ICON: Record<EditorSection['kind'], keyof typeof Ionicons.glyphMap> = {
  video: 'videocam',
  form: 'text',
  color: 'color-palette',
  music: 'musical-notes',
  image: 'image-outline',
  partial: 'cube-outline',
};

interface SceneCardProps {
  index: number;
  count: number;
  section: EditorSection;
  t: TFunction<'editor'>;
  defaultCountdownSeconds: (duration: number) => number;
  onChange: (p: Partial<EditorSection>) => void;
  onLayers: (layers: BackgroundLayer[]) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMove: (dir: -1 | 1) => void;
  onEditOverlay: (overlayIndex: number) => void;
}

export const SceneCard = (props: SceneCardProps) => {
  const { index, count, section, t, defaultCountdownSeconds, onChange, onRemove, onDuplicate, onMove, onEditOverlay } =
    props;
  const [collapsed, setCollapsed] = useState(false);

  return (
    <View testID={`section-${index}`} style={sceneStyles.card}>
      <View style={sceneStyles.cardHeader}>
        <TouchableOpacity
          style={sceneStyles.cardTitle}
          accessibilityRole="button"
          accessibilityLabel={collapsed ? t('scene.expand') : t('scene.collapse')}
          accessibilityState={{ expanded: !collapsed }}
          testID={`section-${index}-collapse`}
          onPress={() => {
            setCollapsed((c) => !c);
          }}
        >
          <Ionicons name={collapsed ? 'chevron-forward' : 'chevron-down'} size={16} color={colors.textSecondary} />
          <View style={sceneStyles.numberBadge}>
            <Text style={sceneStyles.numberBadgeText}>{index + 1}</Text>
          </View>
          <Ionicons name={KIND_ICON[section.kind]} size={18} color={colors.primary} />
          <Text style={sceneStyles.cardTitleText}>{SECTION_LABELS[section.kind]}</Text>
        </TouchableOpacity>
        <View style={sceneStyles.cardActions}>
          <IconBtn
            testID={`section-${index}-up`}
            icon="chevron-up"
            disabled={index === 0}
            onPress={() => {
              onMove(-1);
            }}
          />
          <IconBtn
            testID={`section-${index}-down`}
            icon="chevron-down"
            disabled={index === count - 1}
            onPress={() => {
              onMove(1);
            }}
          />
          <IconBtn testID={`section-${index}-duplicate`} icon="copy-outline" onPress={onDuplicate} />
          <IconBtn testID={`section-${index}-remove`} icon="trash-outline" tint={colors.error} onPress={onRemove} />
        </View>
      </View>

      {collapsed ? null : (
        <>
          <SceneBasics
            index={index}
            section={section}
            t={t}
            defaultCountdownSeconds={defaultCountdownSeconds}
            onChange={onChange}
            onEditOverlay={onEditOverlay}
          />
          <SceneAdvanced section={section} t={t} onChange={onChange} onLayers={props.onLayers} />
        </>
      )}
    </View>
  );
};

interface SceneAdvancedProps {
  section: EditorSection;
  t: TFunction<'editor'>;
  onChange: (p: Partial<EditorSection>) => void;
  onLayers: (layers: BackgroundLayer[]) => void;
}

const SceneAdvanced = ({ section, t, onChange, onLayers }: SceneAdvancedProps) => {
  if (!isVisualKind(section.kind)) return null;

  if (section.kind === 'video') {
    return (
      <View>
        <Disclosure title={t('advanced.look')} icon="color-filter-outline">
          <LookCarousel
            look={section.look}
            t={t}
            onChange={(look) => {
              onChange({ look });
            }}
          />
        </Disclosure>
        <Disclosure title={t('advanced.fineTune')} icon="options-outline">
          <GradeFields
            grade={section.grade}
            t={t}
            onChange={(grade) => {
              onChange({ grade });
            }}
          />
        </Disclosure>
        <Disclosure title={t('advanced.caption')} icon="text-outline">
          <CaptionFields
            caption={section.caption}
            t={t}
            onChange={(caption) => {
              onChange({ caption });
            }}
          />
        </Disclosure>
        <Disclosure title={t('advanced.audio')} icon="volume-medium-outline">
          <SectionAudioFields
            musicVolume={section.musicVolume}
            audioFade={section.audioFade}
            t={t}
            onChange={onChange}
          />
        </Disclosure>
        <Disclosure title={t('advanced.cameraGuide')} icon="body-outline">
          <FramingGuideRow
            guide={section.framingGuide}
            t={t}
            onChange={(framingGuide) => {
              onChange({ framingGuide });
            }}
          />
        </Disclosure>
      </View>
    );
  }

  if (section.kind === 'color') {
    return (
      <View>
        <Disclosure title={t('advanced.layers')} icon="layers-outline">
          <LayerRows layers={section.layers} baseColor={section.color} t={t} onChange={onLayers} />
        </Disclosure>
        <Disclosure title={t('advanced.look')} icon="color-filter-outline">
          <LookCarousel
            look={section.look}
            t={t}
            onChange={(look) => {
              onChange({ look });
            }}
          />
        </Disclosure>
        <Disclosure title={t('advanced.fineTune')} icon="options-outline">
          <GradeFields
            grade={section.grade}
            t={t}
            onChange={(grade) => {
              onChange({ grade });
            }}
          />
        </Disclosure>
        <Disclosure title={t('advanced.caption')} icon="text-outline">
          <CaptionFields
            caption={section.caption}
            t={t}
            onChange={(caption) => {
              onChange({ caption });
            }}
          />
        </Disclosure>
        <Disclosure title={t('advanced.audio')} icon="volume-medium-outline">
          <SectionAudioFields
            musicVolume={section.musicVolume}
            audioFade={section.audioFade}
            t={t}
            onChange={onChange}
          />
        </Disclosure>
      </View>
    );
  }

  if (section.kind !== 'image') return null;

  return (
    <View>
      <Disclosure title={t('advanced.motion')} icon="move-outline">
        <MotionFields
          motion={section.motion}
          t={t}
          onChange={(motion) => {
            onChange({ motion });
          }}
        />
      </Disclosure>
      <Disclosure title={t('advanced.look')} icon="color-filter-outline">
        <LookCarousel
          look={section.look}
          t={t}
          onChange={(look) => {
            onChange({ look });
          }}
        />
      </Disclosure>
      <Disclosure title={t('advanced.fineTune')} icon="options-outline">
        <GradeFields
          grade={section.grade}
          t={t}
          onChange={(grade) => {
            onChange({ grade });
          }}
        />
      </Disclosure>
      <Disclosure title={t('advanced.caption')} icon="text-outline">
        <CaptionFields
          caption={section.caption}
          t={t}
          onChange={(caption) => {
            onChange({ caption });
          }}
        />
      </Disclosure>
      <Disclosure title={t('advanced.audio')} icon="volume-medium-outline">
        <SectionAudioFields musicVolume={section.musicVolume} audioFade={section.audioFade} t={t} onChange={onChange} />
      </Disclosure>
    </View>
  );
};
