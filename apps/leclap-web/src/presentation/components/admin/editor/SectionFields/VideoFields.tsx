// Field block for a project_video section. Essentials (always visible): duration + mute, the
// optional countdown, and the WYSIWYG text-overlay editor — the title is the main creative act, so
// it stays one click away. The finishing controls (Effects, Section audio, Camera guide) live in
// collapsed disclosures that only appear in Advanced mode.
import { Sparkles, Music, Camera, Layers } from '@/presentation/components/icons';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/presentation/components/ui';
import { defaultCountdownFor, type EditorSection, type EditorState } from '../../templateEditorModel';
import { VariableTextField } from '../VariableTextField';
import { FramingGuidePicker } from '../FramingGuidePicker';
import { SectionDisclosure } from '../SectionDisclosure';
import { useIsAdvanced } from '../useBuilderMode';
import { effectsSummary, audioSummary, framingSummary, overlaysSummary } from '../sectionHints';
import { OverlaysField } from '../OverlaysField';
import { NumberField } from './NumberField';
import { SectionAudioFields } from './SectionAudioFields';
import { VisualEffects } from './VisualEffects';

type VideoSection = Extract<EditorSection, { kind: 'video' }>;

interface VideoFieldsProps {
  section: VideoSection;
  orientation: EditorState['orientation'];
  variables: string[];
  onChange: (p: Partial<EditorSection>) => void;
  inputCls: string;
}

export const VideoFields = ({ section, orientation, variables, onChange, inputCls }: VideoFieldsProps) => {
  const { t } = useTranslation('admin');
  const advanced = useIsAdvanced();

  // Changing the clip duration re-syncs an un-customized countdown so a short take
  // never waits behind a long lead-in (and vice-versa). A hand-edited countdown is left alone.
  const setDuration = (duration: number) => {
    const syncCountdown = section.countdown && !section.countdownCustomized;

    onChange({ duration, ...(syncCountdown ? { countdownSeconds: defaultCountdownFor(duration) } : {}) });
  };

  // Enabling the countdown seeds it from the clip duration (and marks it un-customized so
  // it keeps tracking); disabling just clears the flag.
  const toggleCountdown = (on: boolean) => {
    if (!on) {
      onChange({ countdown: false });

      return;
    }

    onChange({ countdown: true, countdownSeconds: defaultCountdownFor(section.duration), countdownCustomized: false });
  };

  return (
    <div className="space-y-3 pl-7">
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField label={t('video.duration')} value={section.duration} onChange={setDuration} inputCls={inputCls} />
        <label className="mt-6 flex cursor-pointer select-none items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
          <Checkbox
            checked={section.mute}
            onCheckedChange={(c) => {
              onChange({ mute: c === true });
            }}
          />{' '}
          {t('video.muteAudio')}
        </label>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">
          {t('video.whatToFilm')}
        </span>
        <VariableTextField
          multiline
          rows={2}
          value={section.description ?? ''}
          onChange={(text) => {
            onChange({ description: text.trim() === '' ? undefined : text });
          }}
          variables={variables.map((name) => ({ name, scope: 'global' as const }))}
          placeholder={t('video.whatToFilmPlaceholder')}
          className={`${inputCls} resize-none`}
          aria-label={t('video.whatToFilm')}
        />
        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{t('video.whatToFilmHint')}</span>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
          <Checkbox
            checked={section.countdown}
            onCheckedChange={(c) => {
              toggleCountdown(c === true);
            }}
          />{' '}
          {t('video.countdown')}
        </label>
        {section.countdown && (
          <NumberField
            label={t('video.countdownSeconds', { count: section.countdownSeconds })}
            value={section.countdownSeconds}
            onChange={(countdownSeconds) => {
              onChange({ countdownSeconds, countdownCustomized: true });
            }}
            inputCls={inputCls}
          />
        )}
      </div>
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
            label={t('disclosure.overlays')}
            icon={<Layers className="size-4 shrink-0 text-brand-500" aria-hidden />}
            summary={overlaysSummary(t, section.animations, section.images)}
          >
            <OverlaysField
              animations={section.animations}
              images={section.images}
              orientation={orientation}
              onAnimationsChange={(animations) => {
                onChange({ animations });
              }}
              onImagesChange={(images) => {
                onChange({ images });
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
          <SectionDisclosure
            label={t('disclosure.cameraGuide')}
            icon={<Camera className="size-4 shrink-0 text-brand-500" aria-hidden />}
            summary={framingSummary(t, section.framingGuide)}
          >
            <FramingGuidePicker
              guide={section.framingGuide}
              orientation={orientation}
              onChange={(framingGuide) => {
                onChange({ framingGuide });
              }}
            />
          </SectionDisclosure>
        </div>
      )}
    </div>
  );
};
