import type { ReactNode } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import clsx from 'clsx';

// Past this drag distance (px) or downward velocity (px/s) on release, the sheet dismisses;
// below it, the sheet springs back to its open position.
const CLOSE_OFFSET = 90;
const CLOSE_VELOCITY = 480;

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Responsive class hiding the whole sheet above its breakpoint, e.g. "sm:hidden" or "md:hidden". */
  hideClassName?: string;
  /** Extra classes for the sheet panel (spacing, etc.). */
  panelClassName?: string;
  role?: 'dialog' | 'menu';
  ariaLabel?: string;
  id?: string;
};

/**
 * Mobile bottom sheet: a scrim plus a panel that springs up from the bottom edge and can be
 * flicked or dragged down to dismiss (grab handle included). Closes on scrim tap too. Desktop
 * variants of a control should render separately and hide this with `hideClassName`.
 */
export const BottomSheet = ({
  open,
  onClose,
  children,
  hideClassName,
  panelClassName,
  role = 'dialog',
  ariaLabel,
  id,
}: BottomSheetProps) => (
  <AnimatePresence>
    {open && (
      <div className={hideClassName}>
        <motion.div
          aria-hidden="true"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        />
        <motion.div
          id={id}
          role={role}
          aria-label={ariaLabel}
          className={clsx(
            'fixed inset-x-0 bottom-0 z-50 touch-none rounded-t-2xl border border-foreground/10 bg-surface/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-lg)] backdrop-blur-xl',
            panelClassName
          )}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 32, stiffness: 320 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.55 }}
          onDragEnd={(_event, info: PanInfo) => {
            if (info.offset.y > CLOSE_OFFSET || info.velocity.y > CLOSE_VELOCITY) {
              onClose();
            }
          }}
        >
          {/* Grab handle — drag target and sheet affordance. */}
          <div
            aria-hidden="true"
            className="mx-auto mb-2 h-1.5 w-10 cursor-grab rounded-full bg-foreground/20 active:cursor-grabbing"
          />
          {children}
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);
