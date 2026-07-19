// Per-section audio controls surfaced inside each visual section card:
// - Music volume override (0..1 slider; overrides the global mix for this section).
// - Audio fade-in: toggle, duration input, and curve select.
// - Audio fade-out: toggle, duration input, and curve select.
// All changes flow through the parent's onChange (patchSection) — no local state. Every string
// resolves through the `sectionAudio.*` locale keys (all five locales carry them).
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui';
import { NumberField } from '@/presentation/components/ui/NumberField';
import { AFADE_CURVES } from 'ffmpeg-video-composer/src/schemas/effects.schemas.ts';
import type { AudioEffect, EditorSection, SectionAudioFade } from '../../templateEditorModel';
import { SegmentedControl, VolumeSlider, type SegmentOption } from '../controls';

// Section options.audioEffect enum (echo/telephone/muffled), plus the sentinel "none" the
// SegmentedControl needs to represent "no effect" as a real, selectable option.
const AUDIO_EFFECT_NONE = 'none' as const;
type AudioEffectOption = AudioEffect | typeof AUDIO_EFFECT_NONE;
const AUDIO_EFFECT_OPTIONS: readonly AudioEffect[] = ['echo', 'telephone', 'muffled'];

type VisualSection = Extract<EditorSection, { kind: 'video' } | { kind: 'color' } | { kind: 'image' }>;

interface SectionAudioFieldsProps {
  section: VisualSection;
  onChange: (p: Partial<EditorSection>) => void;
  inputCls: string;
}

// Format a 0..1 volume to a percent string for display.
const pct = (v: number) => `${Math.round(v * 100)}%`;

export const SectionAudioFields = ({ section, onChange }: SectionAudioFieldsProps) => {
  const { t } = useTranslation('admin');
  const fadeInCheckId = useId();
  const fadeOutCheckId = useId();

  const fade = section.audioFade ?? {};
  const hasFadeIn = Boolean(fade.in);
  const hasFadeOut = Boolean(fade.out);

  // Merge an update, then keep only truthy sides — so passing `{ in: undefined }`
  // actually removes that side (a plain `{...fade, ...update}` spread would keep it).
  const patchFade = (update: Partial<SectionAudioFade>) => {
    const merged = { ...fade, ...update };
    const next: SectionAudioFade = {};

    if (merged.in) next.in = merged.in;

    if (merged.out) next.out = merged.out;

    // Drop the whole audioFade when both sides are gone. patchSection merges a Partial,
    // so the key must be present-but-undefined to clear it (omitting it keeps the old value).
    if (!next.in && !next.out) {
      onChange({ audioFade: undefined } as Partial<EditorSection>);

      return;
    }

    onChange({ audioFade: next } as Partial<EditorSection>);
  };

  const toggleFadeIn = (on: boolean) => {
    patchFade({ in: on ? { duration: 0.5 } : undefined });
  };

  const toggleFadeOut = (on: boolean) => {
    patchFade({ out: on ? { duration: 0.5 } : undefined });
  };

  return (
    <div className="space-y-3">
      {/* Per-section music volume override */}
      <VolumeSlider
        label={section.musicVolume === undefined ? t('sectionAudio.musicVolumeGlobal') : t('sectionAudio.musicVolume')}
        value={section.musicVolume ?? 0.5}
        onChange={(musicVolume) => {
          onChange({ musicVolume } as Partial<EditorSection>);
        }}
      />
      {section.musicVolume !== undefined && (
        <button
          type="button"
          onClick={() => {
            onChange({ musicVolume: undefined } as Partial<EditorSection>);
          }}
          className="tap inline-flex items-center gap-1 rounded-lg bg-foreground/5 px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 active:scale-[0.97]"
        >
          {t('sectionAudio.resetToGlobal', { percent: pct(0.5) })}
        </button>
      )}

      {/* Voice effect (effects-pack): echo / telephone / muffled, or none */}
      <AudioEffectField
        value={section.audioEffect}
        onChange={(audioEffect) => {
          onChange({ audioEffect } as Partial<EditorSection>);
        }}
      />

      {/* Fade-in */}
      <div className="rounded-xl border border-foreground/10 bg-surface p-3 space-y-2">
        <label
          htmlFor={fadeInCheckId}
          className="flex cursor-pointer select-none items-center gap-2 text-sm text-gray-700 dark:text-gray-200"
        >
          <Checkbox
            id={fadeInCheckId}
            checked={hasFadeIn}
            onCheckedChange={(c) => {
              toggleFadeIn(c === true);
            }}
          />
          {t('sectionAudio.fadeIn')}
        </label>
        {hasFadeIn && fade.in && (
          <FadeSideFields
            label={t('sectionAudio.fadeIn')}
            duration={fade.in.duration}
            curve={fade.in.curve}
            onDuration={(duration) => {
              const current = fade.in;
              patchFade({ in: { duration, curve: current?.curve } });
            }}
            onCurve={(curve) => {
              const current = fade.in;
              patchFade({ in: { duration: current?.duration ?? 0.5, curve: curve || undefined } });
            }}
          />
        )}
      </div>

      {/* Fade-out */}
      <div className="rounded-xl border border-foreground/10 bg-surface p-3 space-y-2">
        <label
          htmlFor={fadeOutCheckId}
          className="flex cursor-pointer select-none items-center gap-2 text-sm text-gray-700 dark:text-gray-200"
        >
          <Checkbox
            id={fadeOutCheckId}
            checked={hasFadeOut}
            onCheckedChange={(c) => {
              toggleFadeOut(c === true);
            }}
          />
          {t('sectionAudio.fadeOut')}
        </label>
        {hasFadeOut && fade.out && (
          <FadeSideFields
            label={t('sectionAudio.fadeOut')}
            duration={fade.out.duration}
            curve={fade.out.curve}
            onDuration={(duration) => {
              const current = fade.out;
              patchFade({ out: { duration, curve: current?.curve } });
            }}
            onCurve={(curve) => {
              const current = fade.out;
              patchFade({ out: { duration: current?.duration ?? 0.5, curve: curve || undefined } });
            }}
          />
        )}
      </div>
    </div>
  );
};

// Voice effect segmented control: echo/telephone/muffled + a "None" option that clears the field.
const AudioEffectField = ({
  value,
  onChange,
}: {
  value: AudioEffect | undefined;
  onChange: (value: AudioEffect | undefined) => void;
}) => {
  const { t } = useTranslation('admin');

  const options: ReadonlyArray<SegmentOption<AudioEffectOption>> = [
    { value: AUDIO_EFFECT_NONE, label: t('sectionAudio.effectNone') },
    ...AUDIO_EFFECT_OPTIONS.map((effect) => ({ value: effect, label: t(`sectionAudio.effect.${effect}`) })),
  ];

  return (
    <SegmentedControl
      label={t('sectionAudio.effect.label')}
      value={value ?? AUDIO_EFFECT_NONE}
      options={options}
      onChange={(next) => {
        onChange(next === AUDIO_EFFECT_NONE ? undefined : next);
      }}
    />
  );
};

interface FadeSideFieldsProps {
  label: string;
  duration: number;
  curve?: string;
  onDuration: (v: number) => void;
  onCurve: (v: string) => void;
}

const FadeSideFields = ({ label, duration, curve, onDuration, onCurve }: FadeSideFieldsProps) => {
  const { t } = useTranslation('admin');
  const durId = useId();
  const curveId = useId();

  return (
    <div className="grid gap-2 sm:grid-cols-2 pl-6">
      <NumberField
        id={durId}
        label={t('sectionAudio.duration')}
        aria-label={t('sectionAudio.fadeDuration', { side: label })}
        value={duration}
        min={0}
        max={10}
        step={0.1}
        unit="s"
        compact
        className="w-full"
        onChange={(v) => {
          if (v > 0) onDuration(v);
        }}
      />
      <div>
        <label htmlFor={curveId} className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">
          {t('sectionAudio.curve')}
        </label>
        <Select value={curve ?? 'tri'} onValueChange={onCurve}>
          <SelectTrigger id={curveId} aria-label={t('sectionAudio.fadeCurve', { side: label })}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {/* Friendly name first, raw FFmpeg id in parens (falls back to the id if a label is
                ever missing) — the select never reads as a bare engine-token list. */}
            {AFADE_CURVES.map((c) => (
              <SelectItem key={c} value={c}>
                {t(`sectionAudio.curves.${c}`, c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
