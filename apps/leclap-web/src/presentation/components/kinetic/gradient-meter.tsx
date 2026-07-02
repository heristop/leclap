import { useId } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import { kineticMotion } from './motion';
import { arcRadius, barPct, circumference, clamp01, dashOffset, showShimmer } from './gradient-meter.logic';

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
  /** Ride a travelling shimmer highlight along the fill while in progress (opt-in). */
  shimmer?: boolean;
  className?: string;
}

// The progress vocabulary shared across the app — the signature lavender→pink fill expressed as a
// slim `bar`, a `playhead` scrubber (bar + a riding tick) or an `arc` ring (SVG). One component so
// card meters, preview scrubbers and render rings read as one family. Reduced-motion snaps to value.
// `success` swaps the fill to the settled success treatment at completion, and `shimmer` rides a
// travelling highlight along an in-progress fill — both opt-in, so existing meters are unchanged.
export function GradientMeter({
  progress,
  variant = 'bar',
  size,
  stroke = 6,
  label,
  success = false,
  shimmer = false,
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
      shimmer={shimmer}
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
  shimmer: boolean;
  label?: string;
  className?: string;
}

function LinearMeter({ progress, height, showThumb, success, shimmer, label, className }: LinearMeterProps) {
  const reduced = useReducedMotion();
  const pct = barPct(progress);
  const transition = { duration: reduced ? 0 : kineticMotion.duration.ring, ease: [0.16, 1, 0.3, 1] as const };
  const shimmering = showShimmer(shimmer, success, progress);

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
      >
        {shimmering && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -skew-x-12 animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/25 to-transparent motion-reduce:hidden"
          />
        )}
      </motion.div>
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
