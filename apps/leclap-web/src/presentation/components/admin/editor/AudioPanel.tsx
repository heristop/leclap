// Global audio finishing panel. Replaces the old two-slider AudioMixEditor with the
// full global mix: source/music volumes, loudness normalisation (off/loudnorm/
// dynaudnorm) and speech-ducking. All four map to state.audio (AudioMix).
// Per-section music volume overrides and audio fades are on each visual section card
// via SectionAudioFields — they map to EditorSection.musicVolume / .audioFade.
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Waves, Mic } from 'lucide-react';
import { Checkbox } from '@/presentation/components/ui';
import type { AudioMix } from '../templateEditorModel';
import { SegmentedControl, VolumeSlider, type SegmentOption } from './controls';

interface AudioPanelProps {
  audio: AudioMix;
  onChange: (audio: AudioMix) => void;
}

type NormalizeChoice = 'off' | 'loudnorm' | 'dynaudnorm';

export const AudioPanel = ({ audio, onChange }: AudioPanelProps) => {
  const { t } = useTranslation('admin');
  const duckId = useId();

  const normalizeOptions: ReadonlyArray<SegmentOption<NormalizeChoice>> = [
    { value: 'off', label: t('audio.normalizeOff') },
    { value: 'loudnorm', label: t('audio.normalizeLoudnorm') },
    { value: 'dynaudnorm', label: t('audio.normalizeDynamic') },
  ];

  const set = (p: Partial<AudioMix>) => {
    onChange({ ...audio, ...p });
  };

  const setNormalize = (choice: NormalizeChoice) => {
    if (choice === 'off') {
      const { normalize: _drop, ...rest } = audio;
      onChange(rest);

      return;
    }
    set({ normalize: choice });
  };

  return (
    <div>
      <span className="block text-xs font-semibold uppercase tracking-widest text-gray-400">{t('audio.label')}</span>
      <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">{t('audio.hint')}</p>
      <div className="space-y-4 rounded-xl border border-foreground/10 bg-surface p-3">
        <VolumeSlider
          label={t('audio.yourVideo')}
          value={audio.sourceVolume}
          onChange={(sourceVolume) => {
            set({ sourceVolume });
          }}
        />
        <VolumeSlider
          label={t('audio.music')}
          value={audio.musicVolume}
          onChange={(musicVolume) => {
            set({ musicVolume });
          }}
        />
        <div>
          <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-400">
            <Waves className="size-3.5" /> {t('audio.normalize')}
          </span>
          <SegmentedControl value={audio.normalize ?? 'off'} options={normalizeOptions} onChange={setNormalize} />
        </div>
        <label
          htmlFor={duckId}
          className="flex cursor-pointer select-none items-center gap-2 text-sm text-gray-700 dark:text-gray-200"
        >
          <Checkbox
            id={duckId}
            checked={audio.ducking}
            onCheckedChange={(c) => {
              set({ ducking: c === true });
            }}
          />
          <Mic className="size-3.5 text-brand-500" /> {t('audio.ducking')}
        </label>
      </div>
    </div>
  );
};
