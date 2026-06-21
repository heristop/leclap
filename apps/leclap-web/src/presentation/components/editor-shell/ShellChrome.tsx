import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';

interface ShellChromeProps {
  titlebar: ReactNode;
  dock: ReactNode;
  panel: ReactNode;
  monitor: ReactNode;
  timeline: ReactNode;
}

// The studio/editor app frame: a full-viewport portal sitting BELOW the global LeClap header
// (fixed, ~4rem, z-50) so the site header stays visible and on top. Locks body scroll while open.
export const ShellChrome = ({ titlebar, dock, panel, monitor, timeline }: ShellChromeProps) => {
  useLockBodyScroll();

  return createPortal(
    <div className="dark fixed inset-x-0 bottom-0 top-16 z-30 flex flex-col bg-background text-foreground">
      {titlebar}
      {/* One grid holds all four regions. Mobile (flex-col): monitor → panel → timeline → dock
          (the dock is a bottom tab bar, order-last). Desktop: a 5rem·24rem·1fr grid with the
          timeline spanning the full second row below dock·panel·monitor. */}
      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[5rem_24rem_1fr] lg:grid-rows-[minmax(0,1fr)_auto]">
        {dock}
        <section className="order-2 flex min-h-0 flex-1 flex-col overflow-hidden border-foreground/10 bg-surface/30 lg:order-none lg:border-r">
          {panel}
        </section>
        <div className="order-1 max-h-[48vh] min-h-0 sm:max-h-[52vh] lg:order-none lg:max-h-none">{monitor}</div>
        <footer className="track-lane order-3 flex items-stretch border-t border-foreground/10 lg:order-none lg:col-span-3">
          {timeline}
        </footer>
      </div>
    </div>,
    document.body
  );
};
