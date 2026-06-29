import { useTranslation } from 'react-i18next';
import { Clapperboard } from '@/presentation/components/icons';
import { PlayIcon } from '@/presentation/components/icons/play';
import type { StoredProject } from '@/lib/projectModel';

interface ProjectThumbnailProps {
  project: StoredProject;
  /** Captured poster frame for a completed build, or null (draft / still decoding). */
  poster: string | null;
  /** Opens the project (View for completed, Resume for drafts). */
  onOpen: () => void;
}

// The card's preview surface. No per-template color band — completed builds show the REAL render frame
// (sharp, with a legibility scrim + a play affordance), drafts get a calm neutral studio-stage tile with
// a muted clapperboard glyph. The whole tile is a real button labelled "Open {name}".
export const ProjectThumbnail = ({ project, poster, onOpen }: ProjectThumbnailProps) => {
  const { t } = useTranslation('projects');
  const completed = project.status === 'completed';
  const statusLabel = t(`status.${project.status}`);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t('actions.open', { name: project.name })}
      className="tap group/thumb relative block aspect-video w-full overflow-hidden bg-surface-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
    >
      {poster ? (
        <>
          <img
            src={poster}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-contain transition-transform duration-500 group-hover/thumb:scale-[1.03] motion-reduce:transition-none"
          />
          {/* Subtle full-coverage dark scrim — lightens slightly on hover */}
          <span
            aria-hidden
            className="absolute inset-0 bg-black/20 transition-opacity duration-300 group-hover/thumb:opacity-50"
          />
          <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <span aria-hidden className="absolute inset-0 grid place-items-center">
            <span className="grid size-12 place-items-center rounded-full bg-white/90 text-brand-600 shadow-lg ring-1 ring-black/10 transition-transform duration-200 group-hover/thumb:scale-110 motion-reduce:transition-none">
              <PlayIcon size={20} className="[&_polygon]:fill-current" />
            </span>
          </span>
        </>
      ) : (
        // Draft: a calm film-stage tile with a single branded focal point — a clapperboard in a soft,
        // glowing brand tile that reads "your project, ready to shoot" instead of an empty frame. The
        // glow + tile lift gently on hover to signal the whole tile opens the editor.
        <span aria-hidden className="studio-stage absolute inset-0 grid place-items-center">
          <span className="pointer-events-none absolute size-28 rounded-full bg-brand-500/15 blur-2xl transition-opacity duration-300 group-hover/thumb:bg-brand-500/25" />
          <span className="relative grid size-14 place-items-center rounded-2xl bg-brand-500/10 text-brand-300 ring-1 ring-brand-500/20 transition-all duration-300 group-hover/thumb:scale-110 group-hover/thumb:bg-brand-500/15 motion-reduce:transition-none">
            <Clapperboard className="size-7" />
          </span>
        </span>
      )}

      {/* Status chip with a colour-coded dot — green = rendered, amber = still a draft. */}
      <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-wide text-white/90 ring-1 ring-white/15 backdrop-blur-sm">
        <span aria-hidden className={`size-1.5 rounded-full ${completed ? 'bg-success' : 'bg-warning'}`} />
        {statusLabel}
      </span>
    </button>
  );
};
