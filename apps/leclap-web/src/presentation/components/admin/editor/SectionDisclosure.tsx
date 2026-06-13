// An accessible collapsible group used inside a section card to tuck away advanced controls
// (Effects, Audio, Camera guide). Collapsed by default; the header is a real <button> with
// aria-expanded / aria-controls and a chevron that rotates. Expansion animates via grid-template-rows
// (0fr → 1fr) — not height — and the revealed body fades in through FadeIn (the alpha apparition).
// While collapsed, a summary chip on the header tells the author what's configured without expanding.
import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FadeIn } from './FadeIn';

interface SectionDisclosureProps {
  /** Short group title, e.g. "Effects". */
  label: string;
  /** Optional leading glyph. */
  icon?: ReactNode;
  /** At-a-glance state shown on the collapsed header ("Cinematic · Ken Burns" / "None"). */
  summary: string;
  children: ReactNode;
}

export const SectionDisclosure = ({ label, icon, summary, children }: SectionDisclosureProps) => {
  const [open, setOpen] = useState(false);
  const bodyId = useId();

  return (
    <div className="rounded-xl border border-foreground/10 bg-surface/40">
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => !prev);
        }}
        aria-expanded={open}
        aria-controls={bodyId}
        className="tap flex min-h-10 w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
      >
        <ChevronDown
          aria-hidden
          className={cn(
            'size-4 shrink-0 text-gray-500 transition-transform duration-200 ease-[var(--ease-out-expo)]',
            open ? 'rotate-0' : '-rotate-90'
          )}
        />
        {icon}
        <span className="text-sm font-semibold text-foreground">{label}</span>
        {!open && <span className="ml-auto min-w-0 truncate text-xs text-gray-600 dark:text-gray-300">{summary}</span>}
      </button>
      <div
        id={bodyId}
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-[var(--ease-out-expo)] motion-reduce:transition-none',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="overflow-hidden">
          {open && <FadeIn className="space-y-3 px-3 pb-3 pt-1">{children}</FadeIn>}
        </div>
      </div>
    </div>
  );
};
