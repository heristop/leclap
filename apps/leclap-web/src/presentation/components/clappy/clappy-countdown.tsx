import { useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import { useAnimationClock } from '@/hooks/use-animation-clock';
import { Clappy, clappyHeight } from './clappy';
import { COUNTDOWN_SLAM_AT, countdownFrame } from './clappy.logic';

export interface ClappyCountdownProps {
  /** The number on screen (3, 2, 1), or null for "Action!": the slam. */
  value: number | null;
  /** Clappy's width in px. */
  size?: number;
  className?: string;
}

// How long each beat plays: a number's bounce, or the slam and its settle.
const TICK_SECONDS = 0.4;
const ACTION_SECONDS = COUNTDOWN_SLAM_AT + 0.6;

// Clappy on the camera's countdown, doing the job he's named after: he holds the clapper open through
// 3·2·1, a beat on each number, and slams it shut on "Action!". Silent on purpose — the microphone is live
// by then, and a clack would land in the take. The parent keeps him on screen a moment into recording so
// the slam is seen (the overlay is page chrome, never part of the recording). Under reduced motion each
// beat shows its settled pose. Decorative: the countdown's own label speaks for it.
export function ClappyCountdown({ value, size = 120, className }: ClappyCountdownProps) {
  // A fresh beat per number, so each one's clock starts from its own zero.
  return <CountdownBeat key={value ?? 'action'} value={value} size={size} className={className} />;
}

const CountdownBeat = ({
  value,
  size,
  className,
}: Required<Omit<ClappyCountdownProps, 'className'>> & { className?: string }) => {
  const reduced = useReducedMotion() ?? false;
  const length = value === null ? ACTION_SECONDS : TICK_SECONDS;
  const clock = useAnimationClock(!reduced, { until: length });
  const { pose, impact } = countdownFrame(value, reduced ? length : clock);
  const squash = impact * 0.1;

  return (
    <div aria-hidden="true" className={cn('inline-block', className)} style={{ height: clappyHeight(size) }}>
      <div style={{ transform: `scale(${1 + squash}, ${1 - squash})`, transformOrigin: '50% 92%' }}>
        {/* Eyes on the lens for the whole count, never on the pointer; and no clap on a click, since the
            overlay lets every click through to the camera controls under it. */}
        <Clappy size={size} {...pose} followPointer={false} clapOnClick={false} />
      </div>
    </div>
  );
};
