// Global audio finishing panel. Replaces the old two-slider AudioMixEditor with the
// full global mix: source/music volumes, loudness normalisation (off/loudnorm/
// dynaudnorm) and speech-ducking with an advanced fine-tune (threshold/ratio/attack/
// release, the descriptor's DuckingSchema object form). All map to state.audio (AudioMix).
// Per-section music volume overrides and audio fades are on each visual section card
// via SectionAudioFields — they map to EditorSection.musicVolume / .audioFade.
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WavesIcon } from '@/presentation/components/icons/waves';
import { MicIcon } from '@/presentation/components/icons/mic';
import { ChevronDownIcon } from '@/presentation/components/icons/chevron-down';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/presentation/components/ui';
import type { AudioMix, DuckingSettings } from '../templateEditorModel';
import { RangeSlider, SegmentedControl, VolumeSlider, type SegmentOption } from './controls';

// Engine defaults for the fine-tune knobs (DuckingSchema descriptions) — used to seed the sliders
// so opening "advanced" starts from what `true` already does.
const DUCKING_DEFAULTS: Required<DuckingSettings> = { threshold: 0.05, ratio: 8, attack: 20, release: 400 };

type DuckingKnob = keyof DuckingSettings;

// A knob write: staying exactly on every default collapses the object back to plain `true` so the
// descriptor stays minimal.
function nextDucking(current: DuckingSettings, knob: DuckingKnob, value: number): AudioMix['ducking'] {
  const merged = { ...DUCKING_DEFAULTS, ...current, [knob]: value };
  const allDefault = (Object.keys(DUCKING_DEFAULTS) as DuckingKnob[]).every(
    (key) => merged[key] === DUCKING_DEFAULTS[key]
  );

  return allDefault ? true : merged;
}

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
            <WavesIcon size={14} /> {t('audio.normalize')}
          </span>
          <SegmentedControl value={audio.normalize ?? 'off'} options={normalizeOptions} onChange={setNormalize} />
        </div>
        <label
          htmlFor={duckId}
          className="flex cursor-pointer select-none items-center gap-2 text-sm text-gray-700 dark:text-gray-200"
        >
          <Checkbox
            id={duckId}
            checked={audio.ducking !== false}
            onCheckedChange={(c) => {
              set({ ducking: c === true });
            }}
          />
          <MicIcon size={14} className="text-brand-500" /> {t('audio.ducking')}
        </label>
        {audio.ducking !== false && (
          <DuckingAdvanced
            ducking={audio.ducking}
            onChange={(ducking) => {
              set({ ducking });
            }}
          />
        )}
      </div>
    </div>
  );
};

// The fine-tune disclosure shown while ducking is on. Sliders read from the object form (or the
// engine defaults while ducking is plain `true`); the first non-default write upgrades to the object.
const DuckingAdvanced = ({
  ducking,
  onChange,
}: {
  ducking: true | DuckingSettings;
  onChange: (ducking: AudioMix['ducking']) => void;
}) => {
  const { t } = useTranslation('admin');
  const [open, setOpen] = useState(false);
  const current: DuckingSettings = ducking === true ? {} : ducking;
  const tuned = ducking !== true;

  const knob = (key: DuckingKnob): number => current[key] ?? DUCKING_DEFAULTS[key];

  return (
    <div className="rounded-lg border border-foreground/10">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        className="tap flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-gray-400 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
      >
        {t('audio.duckingAdvanced')}
        {tuned && <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-label={t('grade.customised')} />}
        <ChevronDownIcon size={16} className={cn('ml-auto transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="grid gap-3 px-3 pb-3 sm:grid-cols-2">
          <RangeSlider
            label={t('audio.duckingThreshold')}
            value={knob('threshold')}
            min={0}
            max={1}
            step={0.01}
            resetTo={DUCKING_DEFAULTS.threshold}
            onChange={(v) => {
              onChange(nextDucking(current, 'threshold', v));
            }}
          />
          <RangeSlider
            label={t('audio.duckingRatio')}
            value={knob('ratio')}
            min={1}
            max={20}
            step={0.5}
            format={(v) => `${v}:1`}
            resetTo={DUCKING_DEFAULTS.ratio}
            onChange={(v) => {
              onChange(nextDucking(current, 'ratio', v));
            }}
          />
          <RangeSlider
            label={t('audio.duckingAttack')}
            value={knob('attack')}
            min={1}
            max={500}
            step={1}
            format={(v) => `${v} ms`}
            resetTo={DUCKING_DEFAULTS.attack}
            onChange={(v) => {
              onChange(nextDucking(current, 'attack', v));
            }}
          />
          <RangeSlider
            label={t('audio.duckingRelease')}
            value={knob('release')}
            min={10}
            max={2000}
            step={10}
            format={(v) => `${v} ms`}
            resetTo={DUCKING_DEFAULTS.release}
            onChange={(v) => {
              onChange(nextDucking(current, 'release', v));
            }}
          />
        </div>
      )}
    </div>
  );
};
