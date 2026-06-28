import type { ReactNode } from 'react';
import { Clapperboard } from '@/presentation/components/icons';

interface StudioSurfaceProps {
  title: string;
  subtitle?: string;
  /** Small uppercase eyebrow above the title. */
  kicker?: string;
  /** Right-aligned header actions. */
  actions?: ReactNode;
  children: ReactNode;
}

// A dark, app-style surface for the studio area: it fills the viewport below the global 4rem header
// with a faint brand-tinted dot stage, and tops the content with an editor-style titlebar (brand
// chip + display title + optional subtitle/actions). Mirrors the editor titlebar's look so the
// gallery and the editor read as one app. Presentational only — pages own the content.
export const StudioSurface = ({ title, subtitle, kicker, actions, children }: StudioSurfaceProps) => (
  <div className="dark studio-stage min-h-[calc(100vh-4rem)] bg-background text-foreground">
    <header className="border-b border-foreground/10 bg-surface-2/70 shadow-[inset_0_1px_0_0_oklch(1_0_0/0.04)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 pt-24 pb-6 sm:gap-4">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-500/15 text-brand-500 ring-1 ring-brand-500/20"
        >
          <Clapperboard className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          {kicker && (
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-brand-300/70">{kicker}</p>
          )}
          <h1 className="truncate font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          {subtitle && <p className="mt-1 max-w-[64ch] text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {/* On phones the actions drop to their own full-width row and wrap, instead of overflowing
            the viewport; on sm+ they sit inline at the right, sized to content. */}
        {actions && <div className="flex flex-wrap items-center gap-2 max-sm:w-full sm:shrink-0">{actions}</div>}
      </div>
    </header>

    <div className="mx-auto max-w-6xl px-4 py-10">{children}</div>
  </div>
);
