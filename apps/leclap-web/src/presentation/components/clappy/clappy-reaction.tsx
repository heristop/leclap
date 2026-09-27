import { useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import { useAnimationClock } from '@/hooks/use-animation-clock';
import { Clappy, clappyHeight } from './clappy';
import { REACTION_SECONDS, reactionFrame, type ClappyReaction as Reaction } from './clappy.logic';

export interface ClappyReactionProps {
  reaction: Reaction;
  /** Clappy's width in px. */
  size?: number;
  className?: string;
}

// Clappy taking in a page that went wrong (clappy.logic.ts: reactionFrame): he searches for a missing page,
// scratches his head at a garbled request, calls "cut" on a crash, winks at a new version, dozes offline. He
// pops in, plays the reaction once and holds its last pose; under reduced motion he appears in that pose.
// Decorative: the page's heading says what happened.
export function ClappyReaction({ reaction, size = 136, className }: ClappyReactionProps) {
  const reduced = useReducedMotion() ?? false;
  const length = REACTION_SECONDS[reaction];
  const clock = useAnimationClock(!reduced && length > 0, { until: length });
  const { pose, impact, tilt } = reactionFrame(reaction, reduced ? length : clock);
  const squash = impact * 0.1;

  return (
    <div aria-hidden="true" className={cn('pop-in inline-block', className)} style={{ height: clappyHeight(size) }}>
      <div
        style={{
          transform: `rotate(${tilt}deg) scale(${1 + squash}, ${1 - squash})`,
          transformOrigin: '50% 92%',
        }}
      >
        <Clappy size={size} {...pose} />
      </div>
    </div>
  );
}
