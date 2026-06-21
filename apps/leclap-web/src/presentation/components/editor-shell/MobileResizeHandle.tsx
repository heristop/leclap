import type { PointerEvent as ReactPointerEvent } from 'react';

interface MobileResizeHandleProps {
  onResize: (e: ReactPointerEvent) => void;
  label: string;
}

// The draggable divider between the preview monitor and the controls panel in the mobile stack. A
// full-width grab bar with a grip; `lg:hidden` so it only exists in the stacked mobile layout. Drag
// vertically to grow/shrink the preview vs the controls.
export const MobileResizeHandle = ({ onResize, label }: MobileResizeHandleProps) => (
  <div
    role="separator"
    aria-orientation="horizontal"
    aria-label={label}
    onPointerDown={onResize}
    className="order-2 flex shrink-0 touch-none cursor-row-resize items-center justify-center border-y border-foreground/10 bg-surface-2/40 py-2.5 transition-colors hover:bg-surface-2/70 active:bg-surface-2 lg:hidden"
  >
    <span aria-hidden="true" className="h-1 w-10 rounded-full bg-foreground/25" />
  </div>
);
