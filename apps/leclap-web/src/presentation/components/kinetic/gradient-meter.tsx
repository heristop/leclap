import { useId } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import { kineticMotion } from './motion';
import { arcRadius, barPct, circumference, clamp01, dashOffset, showLiveHead } from './gradient-meter.logic';

type MeterVariant = 'bar' | 'playhead' | 'arc';

export interface GradientMeterProps {
  /** Progress, 0..1. */
  progress: number;
  variant?: MeterVariant;
  /** Arc diameter, or track height for bar/playhead (px). */
  size?: number;
  /** Arc stroke width (px). */
  stroke?: number;
  /** Accessible label; when omitted the meter is decorative (aria-hidden). */
  label?: string;
  /** Swap the on-brand fill for the still success treatment on completion (opt-in). */
  success?: boolean;
  /** Ride a soft head-light on the fill's leading edge while in progress (opt-in). */
  live?: boolean;
  className?: string;
}

// The progress vocabulary shared across the app — the signature lavender→pink fill expressed as a
// slim `bar`, a `playhead` scrubber (bar + a riding tick) or an `arc` ring (SVG). One component so
// card meters, preview scrubbers and render rings read as one family. Reduced-motion snaps to value.
// `success` swaps the fill to the settled success treatment at completion, and `live` puts a soft
// head-light on an in-progress fill's leading edge — both opt-in, so existing meters are unchanged.
export function GradientMeter({
  progress,
  variant = 'bar',
  size,
  stroke = 6,
  label,
  success = false,
  live = false,
  className,
}: GradientMeterProps) {
  if (variant === 'arc') {
    return (
      <ArcMeter
        progress={progress}
        size={size ?? 120}
        stroke={stroke}
        success={success}
        label={label}
        className={className}
      />
    );
  }

  return (
    <LinearMeter
      progress={progress}
      height={size ?? 6}
      showThumb={variant === 'playhead'}
      success={success}
      live={live}
      label={label}
      className={className}
    />
  );
}

interface LinearMeterProps {
  progress: number;
  height: number;
  showThumb: boolean;
  success: boolean;
  live: boolean;
  label?: string;
  className?: string;
}

function LinearMeter({ progress, height, showThumb, success, live, label, className }: LinearMeterProps) {
  const reduced = useReducedMotion();
  const pct = barPct(progress);
  const transition = { duration: reduced ? 0 : kineticMotion.duration.ring, ease: [0.16, 1, 0.3, 1] as const };
  const liveHead = showLiveHead(live, success, progress);

  return (
    <div
      role={label ? 'progressbar' : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      aria-valuenow={label ? Math.round(pct) : undefined}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      className={cn('relative w-full overflow-visible bg-brand-500/15', className)}
      style={{ height, borderRadius: height }}
    >
      <motion.div
        className={cn(
          'absolute inset-y-0 left-0 overflow-hidden rounded-full',
          success ? 'bg-success' : 'brand-gradient'
        )}
        initial={{ width: '0%' }}
        animate={{ width: `${pct}%` }}
        transition={transition}
      />
      {/* The one moving part: a tally light riding the fill's leading edge, the way a playhead reads
          on a timeline — this is a video editor, so progress should look like a transport, not like a
          generic loading skeleton. Breathing `scale` lives on the inner span; on the positioned one
          it would overwrite the centering translate, since an animation's transform beats the
          class's. */}
      {liveHead && (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center"
          initial={{ left: '0%' }}
          animate={{ left: `${pct}%` }}
          transition={transition}
        >
          <span
            className="block animate-meter-head rounded-full bg-white/80 shadow-[0_0_10px_2px_oklch(1_0_0/0.45)] motion-reduce:animate-none"
            style={{ width: height * 0.75, height: height * 0.75 }}
          />
        </motion.span>
      )}
      {showThumb && (
        <motion.span
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-secondary-400 bg-surface-2"
          initial={{ left: '0%' }}
          animate={{ left: `${pct}%` }}
          transition={transition}
        />
      )}
    </div>
  );
}

interface ArcMeterProps {
  progress: number;
  size: number;
  stroke: number;
  success: boolean;
  label?: string;
  className?: string;
}

function ArcMeter({ progress, size, stroke, success, label, className }: ArcMeterProps) {
  const reduced = useReducedMotion();
  const gradientId = useId();
  const radius = arcRadius(size, stroke);
  const circ = circumference(radius);
  // The ring shares the bar's success swap: on completion the lavender→pink stroke settles to the
  // success colour instead of the brand gradient.
  const strokeColor = success ? 'var(--color-success)' : `url(#${gradientId})`;

  return (
    <svg
      width={size}
      height={size}
      role={label ? 'progressbar' : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      aria-valuenow={label ? Math.round(clamp01(progress) * 100) : undefined}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      className={cn('-rotate-90', className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--color-brand-500)" />
          <stop offset="1" stopColor="var(--color-secondary-400)" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-brand-500/15" />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={strokeColor}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: dashOffset(circ, progress) }}
        transition={{ duration: reduced ? 0 : kineticMotion.duration.ring, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  );
}

export default GradientMeter;
