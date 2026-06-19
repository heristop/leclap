'use client';

import { motion, useAnimation, type Variants } from 'motion/react';
import { forwardRef, useCallback, useImperativeHandle, useRef, type SVGProps } from 'react';

import { cn } from '@/lib/utils';

export interface PlayIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface PlayIconProps extends Omit<
  SVGProps<SVGSVGElement>,
  'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd' | 'values'
> {
  size?: number;
}

const PATH_VARIANTS: Variants = {
  normal: {
    x: 0,
    rotate: 0,
  },
  animate: {
    x: [0, -1, 2, 0],
    rotate: [0, -10, 0, 0],
    transition: {
      duration: 0.5,
      times: [0, 0.2, 0.5, 1],
      stiffness: 260,
      damping: 20,
    },
  },
};

const PlayIcon = forwardRef<PlayIconHandle, PlayIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 24, ...props }, ref) => {
    const controls = useAnimation();
    const isControlledRef = useRef(false);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;

      return {
        startAnimation: () => controls.start('animate'),
        stopAnimation: () => controls.start('normal'),
      };
    });

    const handleMouseEnter = useCallback(
      (e: React.MouseEvent<SVGSVGElement>) => {
        if (isControlledRef.current) {
          onMouseEnter?.(e);

          return;
        }

        controls.start('animate').catch(() => {});
      },
      [controls, onMouseEnter]
    );

    const handleMouseLeave = useCallback(
      (e: React.MouseEvent<SVGSVGElement>) => {
        if (isControlledRef.current) {
          onMouseLeave?.(e);

          return;
        }

        controls.start('normal').catch(() => {});
      },
      [controls, onMouseLeave]
    );

    return (
      <motion.svg
        className={cn('lucide', className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
        fill="none"
        height={size}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        width={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        <motion.polygon animate={controls} points="6 3 20 12 6 21 6 3" variants={PATH_VARIANTS} />
      </motion.svg>
    );
  }
);

PlayIcon.displayName = 'PlayIcon';

export { PlayIcon };
