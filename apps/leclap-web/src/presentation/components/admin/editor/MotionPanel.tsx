// Motion control for visual sections: pick one of the engine's motion effects — Ken Burns (direction
// grid + intensity), rotate (angle), flip (axis) or crop (centered percent box) — with a live CSS
// preview approximating the move. Writes section.motion = [effect] (single effect; the engine accepts
// an ordered list — list editing is a follow-up). Pure read/write logic lives in motionPanel.logic.ts.
import { useId, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ZoomIn, ZoomOut, ArrowLeft, ArrowRight } from '@/presentation/components/icons';
import { ArrowUpIcon } from '@/presentation/components/icons/arrow-up';
import { ArrowDownIcon } from '@/presentation/components/icons/arrow-down';
import { SparklesIcon } from '@/presentation/components/icons/sparkles';
import { useIconHover } from '@/presentation/components/icons/useIconHover';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/presentation/components/ui';
import type { MotionEffect } from '../templateEditorModel';
import { PreviewSurface } from './PreviewSurface';
import { RangeSlider, SegmentedControl, type SegmentOption } from './controls';
import {
  MOTION_KINDS,
  activeMotion,
  defaultMotion,
  writeMotion,
  cropExpr,
  cropPercent,
  DEFAULT_INTENSITY,
  DEFAULT_SHAKE_INTENSITY,
  DEFAULT_SHAKE_FREQUENCY,
  DEFAULT_PULSE_INTENSITY,
  DEFAULT_PULSE_FREQUENCY,
  type MotionKind,
} from './motionPanel.logic';

type Direction = 'in' | 'out' | 'left' | 'right' | 'up' | 'down';

const DIRECTIONS: Array<{ value: Direction; icon: ComponentType<{ className?: string }>; titleKey: string }> = [
  { value: 'in', icon: ZoomIn, titleKey: 'motion.zoomIn' },
  { value: 'out', icon: ZoomOut, titleKey: 'motion.zoomOut' },
  { value: 'left', icon: ArrowLeft, titleKey: 'motion.panLeft' },
  { value: 'right', icon: ArrowRight, titleKey: 'motion.panRight' },
  { value: 'up', icon: ArrowUpIcon, titleKey: 'motion.panUp' },
  { value: 'down', icon: ArrowDownIcon, titleKey: 'motion.panDown' },
];

const KIND_LABEL_KEY: Record<MotionKind, string> = {
  kenburns: 'motion.kindKenburns',
  rotate: 'motion.kindRotate',
  flip: 'motion.kindFlip',
  crop: 'motion.kindCrop',
  shake: 'motion.kindShake',
  pulse: 'motion.kindPulse',
};

interface MotionPanelProps {
  motion: MotionEffect[] | undefined;
  onChange: (motion: MotionEffect[] | undefined) => void;
}

export const MotionPanel = ({ motion, onChange }: MotionPanelProps) => {
  const { t } = useTranslation('admin');
  const effect = activeMotion(motion);
  const enabled = effect !== null;

  const write = (next: MotionEffect | null) => {
    onChange(writeMotion(next));
  };

  const kindOptions: ReadonlyArray<SegmentOption<MotionKind>> = MOTION_KINDS.map((kind) => ({
    value: kind,
    label: t(KIND_LABEL_KEY[kind]),
  }));

  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">
        {t('motion.label')}
      </span>
      <div className="grid gap-3 rounded-xl border border-foreground/10 bg-surface p-3 sm:grid-cols-[1fr_8rem]">
        <div className="space-y-3">
          <ToggleRow
            enabled={enabled}
            t={t}
            onToggle={() => {
              write(enabled ? null : defaultMotion('kenburns'));
            }}
          />
          {effect && (
            <>
              <SegmentedControl
                label={t('motion.type')}
                value={effect.type}
                options={kindOptions}
                onChange={(kind) => {
                  // Switching type replaces the effect with that type's defaults (single-effect MVP).
                  write(kind === effect.type ? effect : defaultMotion(kind));
                }}
              />
              <EffectControls effect={effect} t={t} onChange={write} />
            </>
          )}
        </div>
        <MotionPreview effect={effect} />
      </div>
    </div>
  );
};

type EffectFieldsProps<T extends MotionEffect> = {
  effect: T;
  t: TFunction<'admin'>;
  onChange: (effect: MotionEffect) => void;
};

const KenburnsControls = ({ effect, t, onChange }: EffectFieldsProps<Extract<MotionEffect, { type: 'kenburns' }>>) => (
  <>
    <DirectionGrid
      value={effect.direction ?? 'in'}
      t={t}
      onChange={(direction) => {
        onChange({ ...effect, direction });
      }}
    />
    <RangeSlider
      label={t('motion.intensity')}
      value={effect.intensity ?? DEFAULT_INTENSITY}
      min={1.01}
      max={2}
      step={0.01}
      format={(v) => `${v.toFixed(2)}×`}
      resetTo={DEFAULT_INTENSITY}
      onChange={(intensity) => {
        onChange({ ...effect, intensity });
      }}
    />
  </>
);

const RotateControls = ({ effect, t, onChange }: EffectFieldsProps<Extract<MotionEffect, { type: 'rotate' }>>) => (
  <RangeSlider
    label={t('motion.angle')}
    value={effect.angle}
    min={-180}
    max={180}
    step={1}
    format={(v) => `${v}°`}
    resetTo={90}
    onChange={(angle) => {
      onChange({ ...effect, angle });
    }}
  />
);

const FlipControls = ({ effect, t, onChange }: EffectFieldsProps<Extract<MotionEffect, { type: 'flip' }>>) => {
  const axisOptions: ReadonlyArray<SegmentOption<'horizontal' | 'vertical'>> = [
    { value: 'horizontal', label: t('motion.axisHorizontal') },
    { value: 'vertical', label: t('motion.axisVertical') },
  ];

  return (
    <SegmentedControl
      label={t('motion.axis')}
      value={effect.axis}
      options={axisOptions}
      onChange={(axis) => {
        onChange({ ...effect, axis });
      }}
    />
  );
};

const CropControls = ({ effect, t, onChange }: EffectFieldsProps<Extract<MotionEffect, { type: 'crop' }>>) => (
  <>
    <RangeSlider
      label={t('motion.cropWidth')}
      value={cropPercent(effect.w)}
      min={10}
      max={100}
      step={5}
      format={(v) => `${v}%`}
      resetTo={100}
      onChange={(percent) => {
        onChange({ ...effect, w: cropExpr('iw', percent) });
      }}
    />
    <RangeSlider
      label={t('motion.cropHeight')}
      value={cropPercent(effect.h)}
      min={10}
      max={100}
      step={5}
      format={(v) => `${v}%`}
      resetTo={100}
      onChange={(percent) => {
        onChange({ ...effect, h: cropExpr('ih', percent) });
      }}
    />
  </>
);

const ShakeControls = ({ effect, t, onChange }: EffectFieldsProps<Extract<MotionEffect, { type: 'shake' }>>) => (
  <>
    <RangeSlider
      label={t('motion.shakeIntensity')}
      value={effect.intensity ?? DEFAULT_SHAKE_INTENSITY}
      min={1}
      max={20}
      step={1}
      format={(v) => `${v}px`}
      resetTo={DEFAULT_SHAKE_INTENSITY}
      onChange={(intensity) => {
        onChange({ ...effect, intensity });
      }}
    />
    <RangeSlider
      label={t('motion.shakeFrequency')}
      value={effect.frequency ?? DEFAULT_SHAKE_FREQUENCY}
      min={0.5}
      max={8}
      step={0.1}
      format={(v) => `${v.toFixed(1)}Hz`}
      resetTo={DEFAULT_SHAKE_FREQUENCY}
      onChange={(frequency) => {
        onChange({ ...effect, frequency });
      }}
    />
  </>
);

const PulseControls = ({ effect, t, onChange }: EffectFieldsProps<Extract<MotionEffect, { type: 'pulse' }>>) => (
  <>
    <RangeSlider
      label={t('motion.pulseIntensity')}
      value={effect.intensity ?? DEFAULT_PULSE_INTENSITY}
      min={1.01}
      max={1.3}
      step={0.01}
      format={(v) => `${v.toFixed(2)}×`}
      resetTo={DEFAULT_PULSE_INTENSITY}
      onChange={(intensity) => {
        onChange({ ...effect, intensity });
      }}
    />
    <RangeSlider
      label={t('motion.pulseFrequency')}
      value={effect.frequency ?? DEFAULT_PULSE_FREQUENCY}
      min={0.25}
      max={4}
      step={0.05}
      format={(v) => `${v.toFixed(2)}/s`}
      resetTo={DEFAULT_PULSE_FREQUENCY}
      onChange={(frequency) => {
        onChange({ ...effect, frequency });
      }}
    />
  </>
);

// The per-type parameter controls, dispatched on the effect's discriminant. Each type's own fields
// live in a sibling component so this dispatcher stays a thin, low-complexity switch.
const EffectControls = ({
  effect,
  t,
  onChange,
}: {
  effect: MotionEffect;
  t: TFunction<'admin'>;
  onChange: (effect: MotionEffect) => void;
}) => {
  if (effect.type === 'kenburns') return <KenburnsControls effect={effect} t={t} onChange={onChange} />;

  if (effect.type === 'rotate') return <RotateControls effect={effect} t={t} onChange={onChange} />;

  if (effect.type === 'flip') return <FlipControls effect={effect} t={t} onChange={onChange} />;

  if (effect.type === 'crop') return <CropControls effect={effect} t={t} onChange={onChange} />;

  if (effect.type === 'shake') return <ShakeControls effect={effect} t={t} onChange={onChange} />;

  return <PulseControls effect={effect} t={t} onChange={onChange} />;
};

const ToggleRow = ({ enabled, t, onToggle }: { enabled: boolean; t: TFunction<'admin'>; onToggle: () => void }) => {
  const id = useId();

  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer select-none items-center gap-2 text-sm text-gray-700 dark:text-gray-200"
    >
      <Checkbox
        id={id}
        checked={enabled}
        onCheckedChange={() => {
          onToggle();
        }}
      />
      <SparklesIcon size={14} className="text-brand-500" /> {t('motion.enable')}
    </label>
  );
};

const DirectionButton = ({
  dir,
  icon: Icon,
  titleKey,
  active,
  t,
  onChange,
}: {
  dir: Direction;
  icon: ComponentType<{ className?: string }>;
  titleKey: string;
  active: boolean;
  t: TFunction<'admin'>;
  onChange: (d: Direction) => void;
}) => {
  const { hoverProps } = useIconHover();

  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={t(titleKey)}
      title={t(titleKey)}
      onClick={() => {
        onChange(dir);
      }}
      className={cn(
        // Fixed 44px square: a real touch target that wraps to a second row on narrow panels.
        'tap grid size-11 place-items-center rounded-lg border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
        active
          ? 'border-brand-500 bg-brand-500/15 text-brand-600 dark:text-brand-300'
          : 'border-foreground/10 text-gray-500 hover:border-brand-500/40 hover:text-foreground'
      )}
      {...hoverProps}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
};

const DirectionGrid = ({
  value,
  t,
  onChange,
}: {
  value: Direction;
  t: TFunction<'admin'>;
  onChange: (d: Direction) => void;
}) => (
  <div role="radiogroup" aria-label={t('motion.direction')} className="flex flex-wrap gap-1.5">
    {DIRECTIONS.map(({ value: dir, icon, titleKey }) => (
      <DirectionButton
        key={dir}
        dir={dir}
        icon={icon}
        titleKey={titleKey}
        active={value === dir}
        t={t}
        onChange={onChange}
      />
    ))}
  </div>
);

// Per-direction end transform; the scene animates from rest to this and back.
const END_TRANSFORM: Record<Direction, (scale: number) => string> = {
  in: (s) => `scale(${s})`,
  out: (s) => `scale(${s}) translate(0,0)`,
  left: (s) => `scale(${s}) translate(6%,0)`,
  right: (s) => `scale(${s}) translate(-6%,0)`,
  up: (s) => `scale(${s}) translate(0,6%)`,
  down: (s) => `scale(${s}) translate(0,-6%)`,
};

// Ken Burns keeps its animated keyframes; rotate/flip/crop are static CSS approximations (the exact
// framing is the engine's job — the preview just shows the move's character).
// rotate/flip/crop are static CSS approximations; each owns its transform calc so the dispatcher
// below stays a thin, low-complexity switch.
const RotatePreview = ({ angle }: { angle: number }) => (
  <StaticPreview sceneStyle={{ transform: `rotate(${angle}deg) scale(0.72)` }} />
);

const FlipPreview = ({ axis }: { axis: 'horizontal' | 'vertical' }) => (
  <StaticPreview sceneStyle={{ transform: axis === 'horizontal' ? 'scaleX(-1)' : 'scaleY(-1)' }} />
);

const CropPreview = ({ w, h }: { w: number | string; h: number | string }) => {
  const widthPct = cropPercent(w);
  const heightPct = cropPercent(h);
  const insetX = ((100 - widthPct) / 2).toFixed(1);
  const insetY = ((100 - heightPct) / 2).toFixed(1);

  return <StaticPreview sceneStyle={{ clipPath: `inset(${insetY}% ${insetX}% ${insetY}% ${insetX}%)` }} />;
};

const MotionPreview = ({ effect }: { effect: MotionEffect | null }) => {
  if (!effect) return <StaticPreview />;

  if (effect.type === 'kenburns') return <KenburnsPreview effect={effect} />;

  if (effect.type === 'rotate') return <RotatePreview angle={effect.angle} />;

  if (effect.type === 'flip') return <FlipPreview axis={effect.axis} />;

  if (effect.type === 'crop') return <CropPreview w={effect.w} h={effect.h} />;

  if (effect.type === 'shake') return <ShakePreview effect={effect} />;

  return <PulsePreview effect={effect} />;
};

const StaticPreview = ({ sceneStyle }: { sceneStyle?: React.CSSProperties }) => (
  <div className="sm:sticky sm:top-2 sm:self-start">
    <PreviewSurface sceneStyle={sceneStyle} className="h-24 w-full" />
  </div>
);

const KenburnsPreview = ({ effect }: { effect: Extract<MotionEffect, { type: 'kenburns' }> }) => {
  const direction = effect.direction ?? 'in';
  const intensity = effect.intensity ?? DEFAULT_INTENSITY;
  const id = `kb-${direction}-${intensity.toFixed(2)}`.replace('.', '_');
  const startScale = direction === 'out' ? intensity : 1;
  const endTransform = direction === 'out' ? 'scale(1)' : END_TRANSFORM[direction](intensity);
  const keyframes = `@keyframes ${id}{from{transform:scale(${startScale})}to{transform:${endTransform}}}`;
  const sceneStyle = {
    animation: `${id} 3s var(--ease-out-expo, ease-in-out) infinite alternate`,
    transformOrigin: 'center',
  };

  return (
    <div className="sm:sticky sm:top-2 sm:self-start">
      <style>{keyframes}</style>
      <PreviewSurface sceneStyle={sceneStyle} className="h-24 w-full" />
    </div>
  );
};

// Handheld shake: a small centered jitter, period scaled by frequency (higher Hz = faster wobble).
// The engine's actual jitter is a wandering crop window; this is a CSS stand-in for the character.
const ShakePreview = ({ effect }: { effect: Extract<MotionEffect, { type: 'shake' }> }) => {
  const intensity = effect.intensity ?? DEFAULT_SHAKE_INTENSITY;
  const frequency = effect.frequency ?? DEFAULT_SHAKE_FREQUENCY;
  const id = `shake-${intensity}-${frequency}`.replace(/\./g, '_');
  const px = Math.min(intensity, 12);
  const duration = (1 / frequency).toFixed(2);
  const keyframes = `@keyframes ${id}{
    0%{transform:translate(0,0)}
    25%{transform:translate(${px}px,-${px * 0.6}px)}
    50%{transform:translate(-${px * 0.8}px,${px * 0.4}px)}
    75%{transform:translate(${px * 0.5}px,${px}px)}
    100%{transform:translate(0,0)}
  }`;
  const sceneStyle = { animation: `${id} ${duration}s linear infinite` };

  return (
    <div className="sm:sticky sm:top-2 sm:self-start">
      <style>{keyframes}</style>
      <PreviewSurface sceneStyle={sceneStyle} className="h-24 w-full" />
    </div>
  );
};

// Zoom pulse: a smooth scale in/out loop, period scaled by frequency (pulses per second).
const PulsePreview = ({ effect }: { effect: Extract<MotionEffect, { type: 'pulse' }> }) => {
  const intensity = effect.intensity ?? DEFAULT_PULSE_INTENSITY;
  const frequency = effect.frequency ?? DEFAULT_PULSE_FREQUENCY;
  const id = `pulse-${intensity}-${frequency}`.replace(/\./g, '_');
  const keyframes = `@keyframes ${id}{from{transform:scale(1)}to{transform:scale(${intensity})}}`;
  const duration = (0.5 / frequency).toFixed(2);
  const sceneStyle = {
    animation: `${id} ${duration}s ease-in-out infinite alternate`,
    transformOrigin: 'center',
  };

  return (
    <div className="sm:sticky sm:top-2 sm:self-start">
      <style>{keyframes}</style>
      <PreviewSurface sceneStyle={sceneStyle} className="h-24 w-full" />
    </div>
  );
};
