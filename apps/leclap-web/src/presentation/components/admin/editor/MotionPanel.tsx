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

// The per-type parameter controls, dispatched on the effect's discriminant.
const EffectControls = ({
  effect,
  t,
  onChange,
}: {
  effect: MotionEffect;
  t: TFunction<'admin'>;
  onChange: (effect: MotionEffect) => void;
}) => {
  if (effect.type === 'kenburns') {
    return (
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
  }

  if (effect.type === 'rotate') {
    return (
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
  }

  if (effect.type === 'flip') {
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
  }

  return (
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
const MotionPreview = ({ effect }: { effect: MotionEffect | null }) => {
  if (effect?.type === 'kenburns') {
    return <KenburnsPreview direction={effect.direction ?? 'in'} intensity={effect.intensity ?? DEFAULT_INTENSITY} />;
  }

  if (effect?.type === 'rotate') {
    return <StaticPreview sceneStyle={{ transform: `rotate(${effect.angle}deg) scale(0.72)` }} />;
  }

  if (effect?.type === 'flip') {
    return <StaticPreview sceneStyle={{ transform: effect.axis === 'horizontal' ? 'scaleX(-1)' : 'scaleY(-1)' }} />;
  }

  if (effect?.type === 'crop') {
    const w = cropPercent(effect.w);
    const h = cropPercent(effect.h);
    const insetX = ((100 - w) / 2).toFixed(1);
    const insetY = ((100 - h) / 2).toFixed(1);

    return <StaticPreview sceneStyle={{ clipPath: `inset(${insetY}% ${insetX}% ${insetY}% ${insetX}%)` }} />;
  }

  return <StaticPreview />;
};

const StaticPreview = ({ sceneStyle }: { sceneStyle?: React.CSSProperties }) => (
  <div className="sm:sticky sm:top-2 sm:self-start">
    <PreviewSurface sceneStyle={sceneStyle} className="h-24 w-full" />
  </div>
);

const KenburnsPreview = ({ direction, intensity }: { direction: Direction; intensity: number }) => {
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
