import { type ReactNode } from 'react';

interface ProgramMonitorProps {
  children: ReactNode;
  label: string;
  note?: string;
  meta?: string;
  swapKey?: string;
}

// The program-monitor stage: the preview floats on a recessed, vignetted workspace (`studio-stage`)
// framed like a video deck — corner registration brackets, a REC tally dot on the status strip and a
// lavender→pink program-out scrubber along the bottom edge, echoing the kinetic ProgramMonitor.
export const ProgramMonitor = ({ children, label, note, meta, swapKey }: ProgramMonitorProps) => (
  <div className="flex h-full min-h-0 flex-col">
    <div className="studio-stage relative min-h-0 flex-1">
      <div key={swapKey} className="fade-in h-full motion-reduce:animate-none">
        {children}
      </div>

      {/* Corner registration brackets — the deck-monitor framing of the kinetic vocabulary. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-3 size-4 rounded-tl-md border-l-2 border-t-2 border-brand-400/50"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-3 size-4 rounded-tr-md border-r-2 border-t-2 border-brand-400/50"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-3 left-3 size-4 rounded-bl-md border-b-2 border-l-2 border-brand-400/50"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-3 right-3 size-4 rounded-br-md border-b-2 border-r-2 border-brand-400/50"
      />

      {/* Program-out scrubber — the signature gradient pinned to the stage's out edge. */}
      <span aria-hidden="true" className="brand-gradient pointer-events-none absolute inset-x-0 bottom-0 h-[3px]" />
    </div>
    <div className="flex items-center justify-between border-t border-foreground/10 bg-surface-2/40 px-4 py-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="size-1.5 animate-pulse rounded-full bg-[var(--color-error)] motion-reduce:animate-none"
        />
        {label}
        {note ? ` · ${note}` : ''}
      </span>
      {meta ? <span className="tabular-nums">{meta}</span> : null}
    </div>
  </div>
);
