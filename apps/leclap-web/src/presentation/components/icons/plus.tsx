'use client';

import { motion, useAnimation } from 'motion/react';
import { forwardRef, useCallback, useImperativeHandle, useRef, type SVGProps } from 'react';

import { cn } from '@/lib/utils';

export interface PlusIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface PlusIconProps extends Omit<
  SVGProps<SVGSVGElement>,
  'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd' | 'values'
> {
  size?: number;
}

const PlusIcon = forwardRef<PlusIconHandle, PlusIconProps>(
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
        transition={{ type: 'spring', stiffness: 100, damping: 15 }}
        variants={{
          normal: {
            rotate: 0,
          },
          animate: {
            rotate: 180,
          },
        }}
        viewBox="0 0 24 24"
        width={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M5 12h14" />
        <path d="M12 5v14" />
      </motion.svg>
    );
  }
);

PlusIcon.displayName = 'PlusIcon';

export { PlusIcon };
