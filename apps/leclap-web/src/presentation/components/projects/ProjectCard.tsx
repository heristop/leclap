import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Copy, Film, Pencil, Play, SquarePen, Trash2 } from 'lucide-react';
import { coverGradient } from '@/lib/poster';
import { relativeTime } from '@/lib/relativeTime';
import { useProjectPoster } from '@/hooks/useProjectPoster';
import { Button, Card } from '@/presentation/components/ui';
import type { StoredProject } from '@/lib/projectModel';

interface ProjectCardProps {
  project: StoredProject;
  onOpen: (project: StoredProject) => void;
  onEdit: (project: StoredProject) => void;
  onDuplicate: (project: StoredProject) => void;
  onDelete: (project: StoredProject) => void;
  onRename: (id: string, name: string) => void;
}

const formatDuration = (seconds: number): string => {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);

  return `${minutes}:${(total % 60).toString().padStart(2, '0')}`;
};

// A saved build. The gradient band is seeded by the TEMPLATE (not the project) so every build of the
// same template shares a hue and the gallery reads as grouped. Completed builds present as watchable
// (centered play + duration); drafts show their clip progress. The title is rename-in-place.
export const ProjectCard = ({ project, onOpen, onEdit, onDuplicate, onDelete, onRename }: ProjectCardProps) => {
  const { t } = useTranslation('projects');
  const completed = project.status === 'completed';
  const elapsed = relativeTime(project.updatedAt, Date.now());
  const clipCount = Object.keys(project.clips).length;
  const poster = useProjectPoster(project);

  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(project.name);

  const commitRename = () => {
    setRenaming(false);
    const trimmed = name.trim();

    if (trimmed && trimmed !== project.name) onRename(project.id, trimmed);
  };

  const cancelRename = () => {
    setRenaming(false);
    setName(project.name);
  };

  return (
    <Card
      onMouseMove={(e) => {
        // Track the pointer for the spotlight glow (cheap: sets CSS vars, no re-render).
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
        e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
      }}
      className="lift spotlight group relative h-full overflow-hidden p-0"
    >
      <div
        className="relative h-24 overflow-hidden"
        style={poster ? undefined : { backgroundImage: coverGradient(project.templateId) }}
      >
        {poster && (
          <>
            <img
              src={poster}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full scale-105 object-cover blur-[3px] transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none"
            />
            {/* The template's seeded gradient as a translucent wash over the frame, so the gallery still
                reads as grouped by template while the real render shows through underneath. */}
            <div
              aria-hidden
              className="absolute inset-0 opacity-55"
              style={{ backgroundImage: coverGradient(project.templateId) }}
            />
          </>
        )}
        <div
          aria-hidden
          className={
            poster
              ? 'absolute inset-0 bg-gradient-to-t from-black/35 to-transparent'
              : 'absolute inset-0 bg-[radial-gradient(115%_115%_at_0%_0%,rgba(255,255,255,0.32),transparent_55%)]'
          }
        />
        <span className="absolute left-3 top-3 rounded-full bg-black/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white ring-1 ring-white/25 backdrop-blur-sm">
          {t(`status.${project.status}`)}
        </span>
        {completed && (
          <span aria-hidden className="absolute inset-0 grid place-items-center">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-white/90 text-brand-600 shadow-lg ring-1 ring-black/5 transition-transform duration-200 group-hover:scale-110 motion-reduce:transition-none">
              <Play className="h-5 w-5 fill-current" />
            </span>
          </span>
        )}
      </div>

      <div className="p-5">
        {renaming ? (
          <input
            value={name}
            autoFocus
            aria-label={t('actions.rename')}
            onChange={(event) => {
              setName(event.target.value);
            }}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitRename();

              if (event.key === 'Escape') cancelRename();
            }}
            className="mb-1.5 w-full rounded-md border border-brand-500/50 bg-surface-2 px-2 py-1 font-display text-lg font-bold text-foreground focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
          />
        ) : (
          <div className="mb-1.5 flex items-center gap-1.5">
            <h3 className="truncate font-display text-lg font-bold text-foreground">{project.name}</h3>
            <button
              type="button"
              aria-label={t('actions.rename')}
              title={t('actions.rename')}
              onClick={() => {
                setName(project.name);
                setRenaming(true);
              }}
              className="tap shrink-0 rounded p-1 text-gray-400 opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 motion-reduce:transition-none"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <p className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {t(`time.${elapsed.key}`, { count: elapsed.count })}
          </span>
          <span aria-hidden>·</span>
          {completed && project.output?.duration ? (
            <span className="inline-flex items-center gap-1.5">
              <Play className="h-3.5 w-3.5" />
              {formatDuration(project.output.duration)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <Film className="h-3.5 w-3.5" />
              {t('clips', { count: clipCount })}
            </span>
          )}
        </p>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="flex-1"
            onClick={() => {
              onOpen(project);
            }}
          >
            {completed ? <Play className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            {completed ? t('actions.view') : t('actions.resume')}
          </Button>
          {completed && (
            <Button
              variant="outline"
              size="sm"
              aria-label={t('actions.edit')}
              title={t('actions.edit')}
              onClick={() => {
                onEdit(project);
              }}
            >
              <SquarePen className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            aria-label={t('actions.duplicate')}
            title={t('actions.duplicate')}
            className="text-gray-400 hover:text-foreground"
            onClick={() => {
              onDuplicate(project);
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={t('actions.delete')}
            title={t('actions.delete')}
            className="text-gray-400 hover:text-[var(--color-error)]"
            onClick={() => {
              onDelete(project);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};
