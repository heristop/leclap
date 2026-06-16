import { useTranslation } from 'react-i18next';
import { Clock, Film, Pencil, Play, Trash2 } from 'lucide-react';
import { coverGradient } from '@/lib/poster';
import { relativeTime } from '@/lib/relativeTime';
import { Button, Card } from '@/presentation/components/ui';
import type { StoredProject } from '@/lib/projectModel';

interface ProjectCardProps {
  project: StoredProject;
  onOpen: (project: StoredProject) => void;
  onDelete: (project: StoredProject) => void;
}

const formatDuration = (seconds: number): string => {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);

  return `${minutes}:${(total % 60).toString().padStart(2, '0')}`;
};

// A saved build. The gradient band is seeded by the TEMPLATE (not the project) so every build of the
// same template shares a hue and the gallery reads as grouped. Completed builds present as watchable
// (centered play + duration); drafts show their clip progress.
export const ProjectCard = ({ project, onOpen, onDelete }: ProjectCardProps) => {
  const { t } = useTranslation('projects');
  const completed = project.status === 'completed';
  const elapsed = relativeTime(project.updatedAt, Date.now());
  const clipCount = Object.keys(project.clips).length;

  return (
    <Card className="lift group relative h-full overflow-hidden p-0">
      <div className="relative h-24 overflow-hidden" style={{ backgroundImage: coverGradient(project.templateId) }}>
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(115%_115%_at_0%_0%,rgba(255,255,255,0.32),transparent_55%)]"
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
        <h3 className="mb-1.5 truncate font-display text-lg font-bold text-foreground">{project.templateName}</h3>
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
          <Button
            variant="ghost"
            size="sm"
            aria-label={t('actions.delete')}
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
