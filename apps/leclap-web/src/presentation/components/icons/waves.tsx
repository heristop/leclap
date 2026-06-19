'use client';

import { motion, useAnimation } from 'motion/react';
import { forwardRef, useCallback, useImperativeHandle, useRef, type SVGProps } from 'react';

import { cn } from '@/lib/utils';

export interface WavesIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface WavesIconProps extends Omit<
  SVGProps<SVGSVGElement>,
  'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd' | 'values'
> {
  size?: number;
}

const WavesIcon = forwardRef<WavesIconHandle, WavesIconProps>(
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
        if (!isControlledRef.current) {
          controls.start('animate').catch(() => {});
        }
        onMouseEnter?.(e);
      },
      [controls, onMouseEnter]
    );

    const handleMouseLeave = useCallback(
      (e: React.MouseEvent<SVGSVGElement>) => {
        if (!isControlledRef.current) {
          controls.start('normal').catch(() => {});
        }
        onMouseLeave?.(e);
      },
      [controls, onMouseLeave]
    );

    return (
      <svg
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
        <motion.path
          animate={controls}
          d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2c2.5 0 2.5-2 5-2c1.3 0 1.9.5 2.5 1"
          initial={{ pathLength: 1 }}
          variants={{
            normal: { pathLength: 1 },
            animate: {
              pathLength: [0, 1],
              transition: { duration: 0.4, ease: 'linear' },
            },
          }}
        />
        <motion.path
          animate={controls}
          d="M2 12c.6.5 1.2 1 2.5 1c2.5 0 2.5-2 5-2c2.6 0 2.4 2 5 2c2.5 0 2.5-2 5-2c1.3 0 1.9.5 2.5 1"
          initial={{ pathLength: 1 }}
          variants={{
            normal: { pathLength: 1 },
            animate: {
              pathLength: [0, 1],
              transition: { duration: 0.4, ease: 'linear' },
            },
          }}
        />
        <motion.path
          animate={controls}
          d="M2 18c.6.5 1.2 1 2.5 1c2.5 0 2.5-2 5-2c2.6 0 2.4 2 5 2c2.5 0 2.5-2 5-2c1.3 0 1.9.5 2.5 1"
          initial={{ pathLength: 1 }}
          variants={{
            normal: { pathLength: 1 },
            animate: {
              pathLength: [0, 1],
              transition: { duration: 0.4, ease: 'linear' },
            },
          }}
        />
      </svg>
    );
  }
);

WavesIcon.displayName = 'WavesIcon';

export { WavesIcon };
