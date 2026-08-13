import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { MediaDropInputProps, MediaDropRootProps } from '@/lib/upload';
import { FilmstripEdge, SnakeBorder } from '@/presentation/components/kinetic';

interface MediaDropzoneProps {
  getRootProps: () => MediaDropRootProps;
  getInputProps: () => MediaDropInputProps;
  isDragActive: boolean;
  /** Increments on every accepted drop; remounts SnakeBorder to replay the pass. */
  dropCount: number;
  disabled?: boolean;
  /** Headline at `sm` and up. */
  title: string;
  /** Headline below `sm`; falls back to `title`. Phones have nothing to drag, so the copy differs. */
  compactTitle?: string;
  /** Always visible — formats and size ceiling. */
  hint: string;
  /** `sm`-and-up only; the secondary "or click to browse" line. */
  detail?: string;
  icon?: ReactNode;
  /** Hover handlers from useIconHover, so the icon animates with the surface. */
  hoverProps?: Pick<MediaDropRootProps, 'onMouseEnter' | 'onMouseLeave'>;
  inputAriaLabel: string;
  badge?: ReactNode;
}

// The intake gate: film enters past the left spine rather than through a centred dashed box, so the
// surface speaks the same vocabulary as the timeline and the program monitor. The drag-over glow is
// functional — it marks the target as armed — not decoration.
//
// Two shapes for one control, preserved from the previous implementation: phones get a short row,
// because there is nothing to drag on a touch device and a tall stack pushes the record button (the
// real primary action) below the fold. The left-aligned spine layout suits both, so the difference is
// now only density and copy rather than a separate arrangement.
export function MediaDropzone({
  getRootProps,
  getInputProps,
  isDragActive,
  dropCount,
  disabled = false,
  title,
  compactTitle,
  hint,
  detail,
  icon,
  hoverProps,
  inputAriaLabel,
  badge,
}: MediaDropzoneProps) {
  // role="button" (from getRootProps) is children-presentational, so everything rendered inside is
  // stripped from the accessibility tree. Pointing the description at the hint puts the formats and
  // the size ceiling back in front of a screen reader, which would otherwise hear the label alone.
  const hintId = useId();

  return (
    <div
      {...getRootProps()}
      {...hoverProps}
      aria-label={inputAriaLabel}
      aria-describedby={hintId}
      className={cn(
        'studio-stage hairline group relative overflow-hidden rounded-2xl py-4 pr-4 pl-8 sm:py-7',
        'tap cursor-pointer transition-[transform,box-shadow,border-color] duration-200 ease-[var(--ease-out-expo)]',
        'focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
        isDragActive && 'glow-brand scale-[1.02] border-brand-500',
        !isDragActive && !disabled && 'hover:border-brand-500/50',
        // Dimmed, not `pointer-events-none`: the surface must keep receiving dragover/drop so it can
        // cancel them. Taking it out of hit-testing would let a drop fall through to the browser's
        // default action, which navigates the tab to the file and discards the whole in-memory
        // session. The hook already refuses to open the picker or accept files while disabled.
        disabled && 'cursor-not-allowed opacity-55'
      )}
    >
      <FilmstripEdge className="absolute inset-y-0 left-0" />

      {/* Keyed on dropCount so the pass replays per landing; the utility self-hides under reduced
          motion. Held back until the first landing, or it would race the border on plain mount. */}
      {dropCount > 0 && <SnakeBorder key={dropCount} />}

      <input {...getInputProps()} aria-label={inputAriaLabel} />

      {badge !== undefined && <div className="absolute top-2.5 right-2.5 tabular-nums">{badge}</div>}

      <div className="flex items-center gap-3">
        {icon !== undefined && (
          <div
            className={cn(
              'shrink-0 rounded-full p-2.5 transition-transform duration-200 ease-[var(--ease-out-expo)]',
              isDragActive ? 'bg-brand-600 text-white' : 'bg-surface/70 text-gray-400 group-hover:scale-105'
            )}
          >
            {icon}
          </div>
        )}

        <div className="min-w-0">
          <p className="font-display text-base leading-tight font-semibold tracking-tight sm:hidden">
            {compactTitle ?? title}
          </p>
          <p className="font-display hidden text-xl leading-tight font-semibold tracking-tight sm:block">{title}</p>

          {detail !== undefined && <p className="mt-1 hidden text-sm text-muted-foreground sm:block">{detail}</p>}

          <p id={hintId} className="mt-0.5 text-xs text-muted-foreground sm:mt-1.5 sm:text-sm">
            {hint}
          </p>
        </div>
      </div>
    </div>
  );
}
