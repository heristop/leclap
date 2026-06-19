'use client';

import { motion, useAnimation, type Variants } from 'motion/react';
import { forwardRef, useCallback, useImperativeHandle, useRef, type SVGProps } from 'react';
import { cn } from '@/lib/utils';

export interface SwitchCameraIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface SwitchCameraIconProps extends Omit<
  SVGProps<SVGSVGElement>,
  'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd' | 'values'
> {
  size?: number;
}

const PATH_VARIANTS: Variants = {
  normal: { pathLength: 1 },
  animate: {
    pathLength: [0, 1],
    transition: { duration: 0.4, ease: 'linear' },
  },
};

const SwitchCameraIcon = forwardRef<SwitchCameraIconHandle, SwitchCameraIconProps>(
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
        animate={controls}
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
        <motion.path
          animate={controls}
          d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"
          initial="normal"
          variants={PATH_VARIANTS}
        />
        <motion.path
          animate={controls}
          d="M13 5h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5"
          initial="normal"
          variants={PATH_VARIANTS}
        />
        <circle cx="12" cy="12" r="3" />
        <motion.path animate={controls} d="m18 22-3-3 3-3" initial="normal" variants={PATH_VARIANTS} />
        <motion.path animate={controls} d="m6 2 3 3-3 3" initial="normal" variants={PATH_VARIANTS} />
      </motion.svg>
    );
  }
);

SwitchCameraIcon.displayName = 'SwitchCameraIcon';

export { SwitchCameraIcon };
