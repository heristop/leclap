import { type ReactNode } from 'react';

interface ProgramMonitorProps {
  children: ReactNode;
  label: string;
  note?: string;
  meta?: string;
  swapKey?: string;
}

// The program-monitor stage: the preview floats on a recessed, vignetted workspace (`studio-stage`)
// with a status strip below (label · note … meta) — framing it as hardware, not a web element.
export const ProgramMonitor = ({ children, label, note, meta, swapKey }: ProgramMonitorProps) => (
  <div className="flex h-full min-h-0 flex-col">
    <div className="studio-stage relative min-h-0 flex-1">
      <div key={swapKey} className="fade-in h-full motion-reduce:animate-none">
        {children}
      </div>
    </div>
    <div className="flex items-center justify-between border-t border-foreground/10 bg-surface-2/40 px-4 py-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="size-1.5 animate-pulse rounded-full bg-brand-500 motion-reduce:animate-none"
        />
        {label}
        {note ? ` · ${note}` : ''}
      </span>
      {meta ? <span className="tabular-nums">{meta}</span> : null}
    </div>
  </div>
);
