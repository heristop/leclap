import { useTranslation } from 'react-i18next';
import { Film, Play } from '@/presentation/components/icons';
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
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover/thumb:scale-[1.03] motion-reduce:transition-none"
          />
          <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <span aria-hidden className="absolute inset-0 grid place-items-center">
            <span className="grid size-12 place-items-center rounded-full bg-white/90 text-brand-600 shadow-lg ring-1 ring-black/10 transition-transform duration-200 group-hover/thumb:scale-110 motion-reduce:transition-none">
              <Play className="size-5 fill-current" />
            </span>
          </span>
        </>
      ) : (
        <span aria-hidden className="studio-stage absolute inset-0 grid place-items-center">
          <Film className="size-10 text-muted-foreground/50" />
        </span>
      )}

      <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-wide text-white/90 ring-1 ring-white/15 backdrop-blur-sm">
        {completed && <span aria-hidden className="size-1.5 rounded-full bg-success" />}
        {statusLabel}
      </span>
    </button>
  );
};
