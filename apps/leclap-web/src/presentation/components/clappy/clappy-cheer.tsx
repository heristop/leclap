import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import { useAnimationClock } from '@/hooks/use-animation-clock';
import { useSound } from '@/hooks/use-sound';
import { Clappy, clappyHeight } from './clappy';
import { CHEER_SECONDS, SLAM_AT, cheerFrame, crossed } from './clappy.logic';

export interface ClappyCheerProps {
  /** Clappy's width in px. */
  size?: number;
  className?: string;
}

// The finishing clap that greets a finished render: Clappy pops in, winds the clapper up and slams it shut —
// the clack plays on that very frame when the sound is on — throws both arms up grinning while the stick
// wobbles back open, then settles into a smile and keeps still. It plays once, when it mounts. Under reduced
// motion he appears already settled, and the clack alone marks the moment. Decorative: the heading beside
// him says the video is ready.
export function ClappyCheer({ size = 88, className }: ClappyCheerProps) {
  const reduced = useReducedMotion() ?? false;
  const clock = useAnimationClock(!reduced, { until: CHEER_SECONDS });
  const seconds = reduced ? CHEER_SECONDS : clock;
  const { clap } = useSound();
  // Where the clock stood when the clack was last considered: the slam sounds once, on the step that
  // reaches it, however often this re-renders.
  const heard = useRef(-1);

  useEffect(() => {
    if (crossed(heard.current, seconds, SLAM_AT)) clap();

    heard.current = seconds;
  }, [seconds, clap]);

  const { pose, impact } = cheerFrame(seconds);
  const squash = impact * 0.12;

  return (
    <div aria-hidden="true" className={cn('pop-in inline-block', className)} style={{ height: clappyHeight(size) }}>
      <div style={{ transform: `scale(${1 + squash}, ${1 - squash})`, transformOrigin: '50% 92%' }}>
        <Clappy size={size} {...pose} />
      </div>
    </div>
  );
}
