import React, { useEffect, useRef, type ComponentType, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { arrowTarget } from '@/presentation/components/builder/rovingKeys';
import { useIconHover, type AnimatedIconHandle } from '@/presentation/components/icons/useIconHover';

const RAIL_SLOT = 4.5; // rem — fixed slot height so the indicator can slide deterministically

export interface ToolItem<Id extends string = string> {
  id: Id;
  icon: ComponentType<{ className?: string }>;
  label: string;
}

interface ToolDockProps<Id extends string> {
  items: ToolItem<Id>[];
  active: Id;
  onSelect: (id: Id) => void;
  ariaLabel: string;
}

interface DockButtonProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  tabIndex: number;
  onSelect: () => void;
  buttonRef: (el: HTMLButtonElement | null) => void;
  onKeyDown: (e: KeyboardEvent) => void;
}

const DockButton = ({ icon: Icon, label, active, tabIndex, onSelect, buttonRef, onKeyDown }: DockButtonProps) => {
  const { ref, hoverProps } = useIconHover();
  const AnimIcon = Icon as unknown as React.ForwardRefExoticComponent<
    { className?: string } & React.RefAttributes<AnimatedIconHandle>
  >;

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onSelect}
      onKeyDown={onKeyDown}
      aria-current={active}
      tabIndex={tabIndex}
      {...hoverProps}
      className={cn(
        'tap relative z-10 flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-[0.65rem] font-medium transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 lg:h-[4.5rem] lg:min-h-0 lg:w-full lg:flex-none lg:py-0',
        active ? 'text-brand-600 dark:text-brand-300' : 'text-foreground/50 hover:text-foreground/80'
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid size-9 place-items-center rounded-xl transition-all duration-200 ease-[var(--ease-spring)]',
          active ? 'bg-brand-500/20 ring-1 ring-brand-500/40' : 'bg-foreground/[0.07]'
        )}
      >
        <AnimIcon className="size-[1.15rem]" ref={ref} />
      </span>
      {label}
    </button>
  );
};

// A tool dock as an ARIA toolbar: a brand-gradient indicator slides to the active tool on desktop;
// Tab reaches it, then arrow keys (either axis) move + activate with a roving tabindex. A bottom
// tab bar on mobile (equal-width, ≥44px targets, safe-area padded), a vertical icon column on
// desktop. The active tool reads via the icon pill on mobile and the sliding indicator on desktop.
// Generic over the tool id type.
export const ToolDock = <Id extends string>({ items, active, onSelect, ariaLabel }: ToolDockProps<Id>) => {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = items.findIndex((item) => item.id === active);
  // Track the prior slot so the indicator's stretch can lean toward the direction it's travelling.
  const prevIndex = useRef(activeIndex);
  const goingDown = activeIndex >= prevIndex.current;

  useEffect(() => {
    prevIndex.current = activeIndex;
  });

  const move = (event: KeyboardEvent, from: number) => {
    const target = arrowTarget(event.key, from, items.length - 1);

    if (target < 0) return;

    event.preventDefault();
    onSelect(items[target].id);
    refs.current[target]?.focus();
  };

  return (
    <nav
      role="toolbar"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      className="relative order-last flex gap-1 border-t border-foreground/10 bg-surface-2 px-2 py-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] lg:order-none lg:flex-col lg:gap-0 lg:border-t-0 lg:border-r lg:py-3 lg:pb-3"
    >
      {activeIndex >= 0 && (
        // Outer slot glides to the active tool (top-0 so the translateY's padding term isn't double-counted
        // against the static-flow baseline). The inner bar carries the visual + a magnetic stretch replayed
        // on each switch (keyed to the slot), leaning toward the travel direction so it looks pulled.
        <span
          aria-hidden="true"
          className="absolute top-0 left-0 hidden w-[3px] transition-transform duration-300 ease-[var(--ease-spring)] motion-reduce:transition-none lg:block"
          style={{
            height: `${RAIL_SLOT}rem`,
            transform: `translateY(calc(0.75rem + ${activeIndex} * ${RAIL_SLOT}rem))`,
          }}
        >
          <span
            key={activeIndex}
            className="brand-gradient block h-full w-full rounded-r-full will-change-transform motion-safe:animate-dock-stretch"
            style={{ transformOrigin: goingDown ? 'top' : 'bottom' }}
          />
        </span>
      )}
      {items.map((item, i) => (
        <DockButton
          key={item.id}
          icon={item.icon}
          label={item.label}
          active={item.id === active}
          tabIndex={item.id === active ? 0 : -1}
          buttonRef={(el) => {
            refs.current[i] = el;
          }}
          onKeyDown={(e) => {
            move(e, i);
          }}
          onSelect={() => {
            onSelect(item.id);
          }}
        />
      ))}
    </nav>
  );
};
