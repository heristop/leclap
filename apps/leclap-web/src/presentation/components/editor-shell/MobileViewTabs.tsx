import { useRef, type ComponentType, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import { arrowTarget } from '@/presentation/components/builder/rovingKeys';

export type ShellView = 'monitor' | 'panel';

export interface ViewTab {
  id: ShellView;
  icon: ComponentType<{ className?: string }>;
  label: string;
}

interface MobileViewTabsProps {
  tabs: [ViewTab, ViewTab];
  active: ShellView;
  onSelect: (view: ShellView) => void;
  ariaLabel: string;
}

// Phone-only surface switcher: in the stacked layout the editing panel and the program monitor are
// two tabs, so each gets the full height between the titlebar and the scene lane and the other is one
// tap away. Hidden at `desk`, where both panes fit side by side.
export const MobileViewTabs = ({ tabs, active, onSelect, ariaLabel }: MobileViewTabsProps) => {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = tabs.findIndex((tab) => tab.id === active);

  // Selecting the tab you are already on is not a switch — buzzing for it would train the hand to
  // ignore the buzz that does mean something.
  const select = (id: ShellView) => {
    if (id !== active) haptic('selection');

    onSelect(id);
  };

  const move = (event: KeyboardEvent, from: number) => {
    const target = arrowTarget(event.key, from, tabs.length - 1);

    if (target < 0) return;

    event.preventDefault();
    select(tabs[target].id);
    refs.current[target]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      className="relative flex shrink-0 border-b border-foreground/10 bg-surface-2/60 desk:hidden"
    >
      {tabs.map((tab, i) => {
        const selected = tab.id === active;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            ref={(el) => {
              refs.current[i] = el;
            }}
            onKeyDown={(e) => {
              move(e, i);
            }}
            // Switch on pointer-down, not click: the tab is a navigation control with nothing to
            // undo, so waiting for release just adds latency to the one thing that should feel
            // instant. Click still fires for keyboard and assistive activation.
            onPointerDown={() => {
              select(tab.id);
            }}
            // `detail === 0` means the click was synthesized by the keyboard or assistive tech, which
            // send no pointer events; a real tap has already been handled above, so ignore its click
            // rather than running the switch twice.
            onClick={(event) => {
              if (event.detail === 0) select(tab.id);
            }}
            className={cn(
              // A full-width bar dipping 4% reads as the whole screen flinching, so the press dips
              // the label instead — the same gesture, scaled to the size of the thing pressed.
              'relative flex min-h-11 min-w-0 flex-1 touch-manipulation items-center justify-center gap-2 px-3 text-sm font-semibold transition-colors duration-200 active:[&>*]:scale-[0.94] short:min-h-9',
              '[&>*]:transition-transform [&>*]:duration-200 [&>*]:ease-[var(--ease-spring)] active:[&>*]:duration-[90ms] active:[&>*]:ease-[var(--ease-smooth)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/50',
              selected ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            <Icon className={cn('size-4 shrink-0', selected && 'text-brand-400')} />
            <span className="truncate">{tab.label}</span>
          </button>
        );
      })}

      {/* The indicator is the only moving part — it slides between the two halves so the switch reads
          as travel across one surface rather than two independent lights blinking on and off. */}
      <span
        aria-hidden="true"
        className="brand-gradient absolute bottom-0 left-0 h-0.5 w-1/2 rounded-full transition-transform duration-300 ease-[var(--ease-spring)] motion-reduce:transition-none"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
      />
    </div>
  );
};
