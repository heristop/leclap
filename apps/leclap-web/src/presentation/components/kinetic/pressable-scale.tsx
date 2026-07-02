import { forwardRef, type ReactNode } from 'react';
import { motion, useReducedMotion, type HTMLMotionProps } from 'motion/react';
import type { HapticInput } from 'web-haptics';
import { cn } from '@/lib/utils';
import { haptic as fireHaptic } from '@/lib/haptics';
import { kineticMotion } from './motion';

export interface PressableScaleProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: ReactNode;
  /** Scale dip on press (default 0.96). */
  scaleTo?: number;
  /** Subtle lift on hover (fine pointers). */
  hoverLift?: boolean;
  /** Haptic pattern fired on press; pass null to silence. */
  haptic?: HapticInput | null;
}

// Tactile tap for anything that isn't a full Button — CTAs, tiles, chips. Dips on press with the
// shared `tap` spring and fires a best-effort haptic, so the surface has native "give". Renders a
// real <button> for accessibility. Honours reduced-motion (no scale/lift). Forwards its ref to the
// underlying <button> so adopters can wire roving-tabindex focus, drag handles or popover anchors.
export const PressableScale = forwardRef<HTMLButtonElement, PressableScaleProps>(function PressableScale(
  {
    children,
    scaleTo = 0.96,
    hoverLift = false,
    haptic = 'selection',
    className,
    onClick,
    disabled,
    type = 'button',
    ...props
  },
  ref
) {
  const reduced = useReducedMotion();

  const handleClick: PressableScaleProps['onClick'] = (event) => {
    if (haptic) fireHaptic(haptic);

    onClick?.(event);
  };

  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled}
      onClick={handleClick}
      className={cn('touch-manipulation', className)}
      whileTap={reduced || disabled ? undefined : { scale: scaleTo }}
      whileHover={reduced || disabled || !hoverLift ? undefined : { y: -2 }}
      transition={kineticMotion.spring.tap}
      {...props}
    >
      {children}
    </motion.button>
  );
});

export default PressableScale;
