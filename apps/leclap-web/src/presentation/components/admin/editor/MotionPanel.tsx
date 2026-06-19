// Ken Burns control for image sections: a direction picker (zoom in/out + pan
// left/right/up/down) and an intensity slider, with a live CSS keyframe preview that
// animates the chosen move. Writes section.motion = [{type:'kenburns',direction,intensity}].
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ZoomIn, ZoomOut, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Sparkles } from '@/presentation/components/icons';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/presentation/components/ui';
import type { MotionEffect } from '../templateEditorModel';
import { PreviewSurface } from './PreviewSurface';
import { RangeSlider } from './controls';

type Direction = 'in' | 'out' | 'left' | 'right' | 'up' | 'down';

const DIRECTIONS: Array<{ value: Direction; icon: typeof ZoomIn; titleKey: string }> = [
  { value: 'in', icon: ZoomIn, titleKey: 'motion.zoomIn' },
  { value: 'out', icon: ZoomOut, titleKey: 'motion.zoomOut' },
  { value: 'left', icon: ArrowLeft, titleKey: 'motion.panLeft' },
  { value: 'right', icon: ArrowRight, titleKey: 'motion.panRight' },
  { value: 'up', icon: ArrowUp, titleKey: 'motion.panUp' },
  { value: 'down', icon: ArrowDown, titleKey: 'motion.panDown' },
];

const DEFAULT_INTENSITY = 1.15;

type KenBurns = Extract<MotionEffect, { type: 'kenburns' }>;

// Reads the single kenburns effect out of the motion list (the only one this panel writes).
function kenburns(motion: MotionEffect[] | undefined): { direction: Direction; intensity: number } | null {
  const effect = motion?.find((m): m is KenBurns => m.type === 'kenburns');

  if (!effect) return null;

  return { direction: effect.direction ?? 'in', intensity: effect.intensity ?? DEFAULT_INTENSITY };
}

interface MotionPanelProps {
  motion: MotionEffect[] | undefined;
  onChange: (motion: MotionEffect[] | undefined) => void;
}

export const MotionPanel = ({ motion, onChange }: MotionPanelProps) => {
  const { t } = useTranslation('admin');
  const current = kenburns(motion);
  const enabled = current !== null;
  const direction = current?.direction ?? 'in';
  const intensity = current?.intensity ?? DEFAULT_INTENSITY;

  const write = (next: { direction: Direction; intensity: number } | null) => {
    const motionList: MotionEffect[] | undefined = next
      ? [{ type: 'kenburns', direction: next.direction, intensity: next.intensity }]
      : undefined;
    onChange(motionList);
  };

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
              write(enabled ? null : { direction, intensity });
            }}
          />
          {enabled && (
            <>
              <DirectionGrid
                value={direction}
                t={t}
                onChange={(d) => {
                  write({ direction: d, intensity });
                }}
              />
              <RangeSlider
                label={t('motion.intensity')}
                value={intensity}
                min={1.01}
                max={2}
                step={0.01}
                format={(v) => `${v.toFixed(2)}×`}
                onChange={(v) => {
                  write({ direction, intensity: v });
                }}
              />
            </>
          )}
        </div>
        <MotionPreview enabled={enabled} direction={direction} intensity={intensity} />
      </div>
    </div>
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
      <Sparkles className="size-3.5 text-brand-500" /> {t('motion.kenBurns')}
    </label>
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
  <div role="radiogroup" aria-label={t('motion.direction')} className="grid grid-cols-6 gap-1.5">
    {DIRECTIONS.map(({ value: dir, icon: Icon, titleKey }) => (
      <button
        key={dir}
        type="button"
        role="radio"
        aria-checked={value === dir}
        title={t(titleKey)}
        onClick={() => {
          onChange(dir);
        }}
        className={cn(
          'tap grid aspect-square place-items-center rounded-lg border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
          value === dir
            ? 'border-brand-500 bg-brand-500/15 text-brand-600 dark:text-brand-300'
            : 'border-foreground/10 text-gray-500 hover:border-brand-500/40 hover:text-foreground'
        )}
      >
        <Icon className="h-4 w-4" />
      </button>
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

const MotionPreview = ({
  enabled,
  direction,
  intensity,
}: {
  enabled: boolean;
  direction: Direction;
  intensity: number;
}) => {
  const id = `kb-${direction}-${intensity.toFixed(2)}`.replace('.', '_');
  const startScale = direction === 'out' ? intensity : 1;
  const endTransform = direction === 'out' ? 'scale(1)' : END_TRANSFORM[direction](intensity);
  const keyframes = `@keyframes ${id}{from{transform:scale(${startScale})}to{transform:${endTransform}}}`;
  const sceneStyle = enabled
    ? { animation: `${id} 3s var(--ease-out-expo, ease-in-out) infinite alternate`, transformOrigin: 'center' }
    : undefined;

  return (
    <div className="sm:sticky sm:top-2 sm:self-start">
      {enabled && <style>{keyframes}</style>}
      <PreviewSurface sceneStyle={sceneStyle} className="h-24 w-full" />
    </div>
  );
};
