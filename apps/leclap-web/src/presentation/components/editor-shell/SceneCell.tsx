import { type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { Check, type LucideIcon } from '@/presentation/components/icons';
import { cn } from '@/lib/utils';

interface SceneCellProps {
  index: number;
  title: string;
  eyebrow: string;
  icon: LucideIcon;
  poster?: ReactNode;
  done?: boolean;
  active?: boolean;
  isNext?: boolean;
  durationLabel?: string;
  role: 'tab' | 'button';
  tabIndex: number;
  onSelect: () => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  onPointerMove?: (e: MouseEvent<HTMLButtonElement>) => void;
  buttonRef?: (el: HTMLButtonElement | null) => void;
  trailing?: ReactNode;
  /** Slightly smaller tile + width, used by the builder filmstrip to keep the mobile rail compact. */
  compact?: boolean;
}

// The 16-high poster tile: a recorded poster (or kind-icon fallback) with the index badge, completion
// check, duration chip and the next/active accent bars overlaid.
const PosterTile = ({
  index,
  icon: Icon,
  poster,
  done,
  active,
  isNext,
  durationLabel,
  compact,
}: Pick<SceneCellProps, 'index' | 'icon' | 'poster' | 'done' | 'active' | 'isNext' | 'durationLabel' | 'compact'>) => (
  <span
    className={cn(
      'relative grid w-full place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-brand-500/25 to-secondary-500/20',
      compact ? 'h-12' : 'h-16'
    )}
  >
    {poster ?? <Icon className="h-6 w-6 text-white/90" />}
    <span className="absolute left-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-black/45 text-[0.7rem] font-bold tabular-nums text-white">
      {index + 1}
    </span>
    {done && (
      <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--color-success)] text-white">
        <Check className="h-3 w-3" strokeWidth={2.5} />
      </span>
    )}
    {durationLabel ? (
      <span className="absolute bottom-1.5 right-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[0.65rem] font-semibold tabular-nums text-white">
        {durationLabel}
      </span>
    ) : null}
    {isNext && !done && <span aria-hidden="true" className="brand-gradient absolute inset-x-0 bottom-0 h-1" />}
    {active && <span aria-hidden="true" className="brand-gradient absolute inset-x-0 top-0 h-0.5" />}
  </span>
);

// One timeline cell — the shared visual for the studio filmstrip and the template-editor timeline.
// A poster (or kind-icon tile), index badge, completion check, duration chip, next-highlight and
// active "playhead" accent, then a kind eyebrow + title. Purely presentational.
export const SceneCell = ({
  index,
  title,
  eyebrow,
  icon,
  poster,
  done = false,
  active = false,
  isNext = false,
  durationLabel,
  role,
  tabIndex,
  onSelect,
  onKeyDown,
  onPointerMove,
  buttonRef,
  trailing,
  compact = false,
}: SceneCellProps) => (
  <div className="relative shrink-0">
    <button
      ref={buttonRef}
      type="button"
      role={role}
      aria-selected={role === 'tab' ? active : undefined}
      aria-current={role === 'button' ? active : undefined}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      onClick={onSelect}
      onMouseMove={onPointerMove}
      className={cn(
        'tap spotlight group relative flex flex-col rounded-xl border p-2 text-left transition-all duration-200 ease-[var(--ease-spring)] motion-reduce:transition-none',
        compact ? 'w-24 gap-1 sm:w-28' : 'w-28 gap-1.5 sm:w-32',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50',
        active
          ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500/40'
          : 'border-foreground/10 bg-surface/50 hover:-translate-y-0.5 hover:border-brand-500/40'
      )}
    >
      <PosterTile
        index={index}
        icon={icon}
        poster={poster}
        done={done}
        active={active}
        isNext={isNext}
        durationLabel={durationLabel}
        compact={compact}
      />
      <span className="block text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-brand-600/70 dark:text-brand-300/60">
        {eyebrow}
      </span>
      <span className="line-clamp-1 text-xs font-medium text-foreground">{title}</span>
    </button>
    {trailing}
  </div>
);
