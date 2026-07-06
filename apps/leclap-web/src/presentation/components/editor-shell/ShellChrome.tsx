import { type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';
import { MobileResizeHandle } from './MobileResizeHandle';
import { useMobileSplit } from './useMobileSplit';

interface ShellChromeProps {
  titlebar: ReactNode;
  dock: ReactNode;
  panel: ReactNode;
  monitor: ReactNode;
  timeline: ReactNode;
  resizeLabel: string;
}

// The studio/editor app frame: a full-viewport portal sitting BELOW the global LeClap header
// (fixed, ~4rem, z-50) so the site header stays visible and on top. Locks body scroll while open.
export const ShellChrome = ({ titlebar, dock, panel, monitor, timeline, resizeLabel }: ShellChromeProps) => {
  useLockBodyScroll();
  const { containerRef, monitorHeight, beginResize, resizeBy } = useMobileSplit();

  return createPortal(
    <>
      {/* Dark fill behind the fixed header so backdrop-blur picks up the dark surface,
        matching studio and template-list pages (z-[29] < z-30 < z-50 header). */}
      <div className="dark fixed inset-x-0 top-0 z-[29] h-16 bg-background" />
      <div className="dark fixed inset-x-0 bottom-0 top-16 z-30 flex flex-col bg-background text-foreground">
        {titlebar}
        {/* One grid holds all regions. Mobile (flex-col): monitor → resize divider → panel → timeline
          → dock (the dock is a bottom tab bar, order-last). The monitor's height is the draggable
          mobile split (`--monitor-h`); `md:h-auto` resets it for the grid tiers, where the timeline
          spans the full second row below dock·panel·monitor. Tablet (md) gets an icon-only dock rail
          and a narrower panel so the monitor keeps priority; the panel widens again at lg/xl. */}
        <div
          ref={containerRef}
          className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[3.75rem_19rem_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[5rem_22rem_minmax(0,1fr)] xl:grid-cols-[5rem_24rem_minmax(0,1fr)]"
        >
          {dock}
          <section className="order-3 flex min-h-0 flex-1 flex-col overflow-hidden border-foreground/10 bg-surface md:order-none md:border-r">
            {panel}
          </section>
          <div
            className="order-1 h-[var(--monitor-h)] min-h-0 shrink-0 md:order-none md:h-auto md:shrink"
            style={{ '--monitor-h': monitorHeight } as CSSProperties}
          >
            {monitor}
          </div>
          <MobileResizeHandle onResize={beginResize} onNudge={resizeBy} label={resizeLabel} />
          <footer className="track-lane order-4 flex items-stretch border-t border-foreground/10 md:order-none md:col-span-3">
            {timeline}
          </footer>
        </div>
      </div>
    </>,
    document.body
  );
};
