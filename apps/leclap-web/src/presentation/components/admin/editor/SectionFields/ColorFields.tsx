// Field block for a color_background section. Essentials (always visible): duration + the layered
// background editor (base color / extra layers). Finishing controls (Effects, Section audio) live in
// collapsed disclosures that only appear in Advanced mode.
import { Sparkles, Music, Film } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { EditorSection, Orientation } from '../../templateEditorModel';
import { LayersEditor } from '../LayersEditor';
import { SectionDisclosure } from '../SectionDisclosure';
import { useIsAdvanced } from '../useBuilderMode';
import { effectsSummary, audioSummary, animationSummary } from '../sectionHints';
import { AnimationOverlayField } from '../AnimationOverlayField';
import { NumberField } from './NumberField';
import { SectionAudioFields } from './SectionAudioFields';
import { VisualEffects } from './VisualEffects';

type ColorSection = Extract<EditorSection, { kind: 'color' }>;

interface ColorFieldsProps {
  section: ColorSection;
  orientation: Orientation;
  onChange: (p: Partial<EditorSection>) => void;
  onLayers: (layers: NonNullable<ColorSection['layers']>) => void;
  inputCls: string;
}

export const ColorFields = ({ section, orientation, onChange, onLayers, inputCls }: ColorFieldsProps) => {
  const { t } = useTranslation('admin');
  const advanced = useIsAdvanced();

  return (
    <div className="space-y-3 pl-7">
      <div className="sm:w-40">
        <NumberField
          label={t('video.duration')}
          value={section.duration}
          onChange={(duration) => {
            onChange({ duration });
          }}
          inputCls={inputCls}
        />
      </div>
      <LayersEditor layers={section.layers} baseColor={section.color} onChange={onLayers} />
      {advanced && (
        <div className="space-y-2">
          <SectionDisclosure
            label={t('disclosure.effects')}
            icon={<Sparkles className="size-4 shrink-0 text-brand-500" aria-hidden />}
            summary={effectsSummary(t, section.look)}
          >
            <VisualEffects
              look={section.look}
              grade={section.grade}
              onLook={(look) => {
                onChange({ look });
              }}
              onGrade={(grade) => {
                onChange({ grade });
              }}
            />
          </SectionDisclosure>
          <SectionDisclosure
            label={t('disclosure.animation')}
            icon={<Film className="size-4 shrink-0 text-brand-500" aria-hidden />}
            summary={animationSummary(t, section.animations)}
          >
            <AnimationOverlayField
              value={section.animations}
              orientation={orientation}
              onChange={(animations) => {
                onChange({ animations });
              }}
            />
          </SectionDisclosure>
          <SectionDisclosure
            label={t('disclosure.audio')}
            icon={<Music className="size-4 shrink-0 text-brand-500" aria-hidden />}
            summary={audioSummary(t, section.audioFade, section.musicVolume !== undefined)}
          >
            <SectionAudioFields section={section} onChange={onChange} inputCls={inputCls} />
          </SectionDisclosure>
        </div>
      )}
    </div>
  );
};
