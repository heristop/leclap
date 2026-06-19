'use client';

import { motion, useAnimation, type Variants } from 'motion/react';
import { forwardRef, useCallback, useImperativeHandle, useRef, type SVGProps } from 'react';

import { cn } from '@/lib/utils';

export interface UploadIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface UploadIconProps extends Omit<
  SVGProps<SVGSVGElement>,
  'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd' | 'values'
> {
  size?: number;
}

const ARROW_VARIANTS: Variants = {
  normal: { y: 0 },
  animate: {
    y: -2,
    transition: {
      type: 'spring',
      stiffness: 200,
      damping: 10,
      mass: 1,
    },
  },
};

const UploadIcon = forwardRef<UploadIconHandle, UploadIconProps>(
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
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <motion.g animate={controls} variants={ARROW_VARIANTS}>
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" x2="12" y1="3" y2="15" />
        </motion.g>
      </svg>
    );
  }
);

UploadIcon.displayName = 'UploadIcon';

export { UploadIcon };
