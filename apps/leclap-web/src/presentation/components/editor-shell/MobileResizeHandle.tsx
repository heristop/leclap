import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';

interface MobileResizeHandleProps {
  onResize: (e: ReactPointerEvent) => void;
  /** Nudges the split by a signed pixel delta — the keyboard path (arrow keys). */
  onNudge: (delta: number) => void;
  label: string;
}

const KEY_STEP = 24; // px per arrow-key press

// The draggable divider between the preview monitor and the controls panel in the mobile stack. A
// full-width grab bar with a grip; `desk:hidden` so it only exists in the stacked layout. Drag
// vertically (the ::before overlay pads the touch target to ~44px) or focus it and use ↑/↓ to
// grow/shrink the preview vs the controls. Only shells that opt out of `ShellChrome`'s view tabs
// (see MobileViewTabs) mount it.
export const MobileResizeHandle = ({ onResize, onNudge, label }: MobileResizeHandleProps) => {
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;

    e.preventDefault();
    onNudge(e.key === 'ArrowUp' ? -KEY_STEP : KEY_STEP);
  };

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={label}
      tabIndex={0}
      onPointerDown={onResize}
      onKeyDown={onKeyDown}
      className="relative order-2 flex shrink-0 touch-none cursor-row-resize items-center justify-center border-y border-foreground/10 bg-surface-2/40 py-2.5 transition-colors before:absolute before:inset-x-0 before:-inset-y-2 before:content-[''] hover:bg-surface-2/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/50 active:bg-surface-2 desk:hidden"
    >
      <span aria-hidden="true" className="h-1 w-10 rounded-full bg-foreground/25" />
    </div>
  );
};
