'use client';

import { motion, useAnimation, type Transition, type Variants } from 'motion/react';
import { forwardRef, useCallback, useImperativeHandle, useRef, type SVGProps } from 'react';

import { cn } from '@/lib/utils';

export interface GlobeIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface GlobeIconProps extends Omit<
  SVGProps<SVGSVGElement>,
  'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd' | 'values'
> {
  size?: number;
}

const SPIN: Transition = { duration: 2.2, ease: 'linear', repeat: Infinity };

// Sweep the meridian's horizontal scale 1 → 0 → -1 → 0 → 1: it squashes to an edge-on line and
// bulges back the other way, reading as the globe turning on its axis. Circle + equator stay put.
const MERIDIAN_VARIANTS: Variants = {
  normal: { scaleX: 1 },
  animate: { scaleX: [1, 0, -1, 0, 1] },
};

const GlobeIcon = forwardRef<GlobeIconHandle, GlobeIconProps>(
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
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20" />
        <motion.path
          animate={controls}
          d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"
          style={{ transformOrigin: '12px 12px' }}
          transition={SPIN}
          variants={MERIDIAN_VARIANTS}
        />
      </svg>
    );
  }
);

GlobeIcon.displayName = 'GlobeIcon';

export { GlobeIcon };
