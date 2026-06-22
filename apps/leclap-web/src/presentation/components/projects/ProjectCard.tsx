import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Film, Pencil, Play } from '@/presentation/components/icons';
import { relativeTime } from '@/lib/relativeTime';
import { useProjectPoster } from '@/hooks/useProjectPoster';
import { Card } from '@/presentation/components/ui';
import { ProjectThumbnail } from './ProjectThumbnail';
import { ProjectActions } from './ProjectActions';
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

// A saved build, presented like a library item in a pro video app: a calm dark card whose hero is the REAL
// render frame (completed) or a neutral studio-stage tile (draft) — no per-template color band. The card
// rests quiet; the action row is revealed on hover / focus-within on pointer devices and always shown on
// touch. The title is rename-in-place.
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
    <Card className="lift spotlight group/card relative flex h-full flex-col overflow-hidden p-0">
      <ProjectThumbnail
        project={project}
        poster={poster}
        onOpen={() => {
          onOpen(project);
        }}
      />

      <div className="flex flex-1 flex-col p-4">
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
            className="field-focus-gradient mb-1.5 w-full rounded-md border border-brand-500/50 bg-surface-inset px-2 py-1 font-display text-base font-bold text-foreground [--field-fill:var(--color-surface-inset)] focus-visible:outline-none"
          />
        ) : (
          <div className="mb-1 flex items-center gap-1.5">
            <h3 className="truncate font-display text-base font-bold text-foreground">{project.name}</h3>
            <button
              type="button"
              aria-label={t('actions.rename')}
              title={t('actions.rename')}
              onClick={() => {
                setName(project.name);
                setRenaming(true);
              }}
              className="tap shrink-0 rounded p-1 text-muted-foreground opacity-100 transition-opacity hover:text-foreground focus-visible:opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100 sm:group-focus-within/card:opacity-100 motion-reduce:transition-none"
            >
              <Pencil className="size-3.5" />
            </button>
          </div>
        )}

        <p className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" />
            {t(`time.${elapsed.key}`, { count: elapsed.count })}
          </span>
          <span aria-hidden>·</span>
          {completed && project.output?.duration ? (
            <span className="inline-flex items-center gap-1.5">
              <Play className="size-3.5" />
              {formatDuration(project.output.duration)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <Film className="size-3.5" />
              {t('clips', { count: clipCount })}
            </span>
          )}
        </p>

        <div className="mt-auto transition-opacity duration-200 sm:opacity-0 sm:group-hover/card:opacity-100 sm:group-focus-within/card:opacity-100 motion-reduce:transition-none">
          <ProjectActions
            project={project}
            onOpen={() => {
              onOpen(project);
            }}
            onEdit={() => {
              onEdit(project);
            }}
            onDuplicate={() => {
              onDuplicate(project);
            }}
            onDelete={() => {
              onDelete(project);
            }}
          />
        </div>
      </div>
    </Card>
  );
};
