// Per-section audio controls surfaced inside each visual section card:
// - Music volume override (0..1 slider; overrides the global mix for this section).
// - Audio fade-in: toggle, duration input, and curve select.
// - Audio fade-out: toggle, duration input, and curve select.
// All changes flow through the parent's onChange (patchSection) — no local state.
import { useId } from 'react';
import { Music } from '@/presentation/components/icons';
import { Checkbox, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui';
import { NumberField } from '@/presentation/components/ui/NumberField';
import { AFADE_CURVES } from 'ffmpeg-video-composer/src/schemas/effects.schemas.ts';
import type { EditorSection, SectionAudioFade } from '../../templateEditorModel';
import { VolumeSlider } from '../controls';

type VisualSection = Extract<EditorSection, { kind: 'video' } | { kind: 'color' } | { kind: 'image' }>;

interface SectionAudioFieldsProps {
  section: VisualSection;
  onChange: (p: Partial<EditorSection>) => void;
  inputCls: string;
}

// Format a 0..1 volume to a percent string for display.
const pct = (v: number) => `${Math.round(v * 100)}%`;

export const SectionAudioFields = ({ section, onChange }: SectionAudioFieldsProps) => {
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
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-400">
        <Music className="size-3.5" /> Section audio
      </span>

      {/* Per-section music volume override */}
      <VolumeSlider
        label={`Music volume${section.musicVolume === undefined ? ' (global)' : ''}`}
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
          Reset to global ({pct(0.5)})
        </button>
      )}

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
          Fade in
        </label>
        {hasFadeIn && fade.in && (
          <FadeSideFields
            label="Fade in"
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
          Fade out
        </label>
        {hasFadeOut && fade.out && (
          <FadeSideFields
            label="Fade out"
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

interface FadeSideFieldsProps {
  label: string;
  duration: number;
  curve?: string;
  onDuration: (v: number) => void;
  onCurve: (v: string) => void;
}

const FadeSideFields = ({ label, duration, curve, onDuration, onCurve }: FadeSideFieldsProps) => {
  const durId = useId();
  const curveId = useId();

  return (
    <div className="grid gap-2 sm:grid-cols-2 pl-6">
      <NumberField
        id={durId}
        label="Duration"
        aria-label={`${label} duration in seconds`}
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
          Curve
        </label>
        <Select value={curve ?? 'tri'} onValueChange={onCurve}>
          <SelectTrigger id={curveId} aria-label={`${label} curve`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AFADE_CURVES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
