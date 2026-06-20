import { useTranslation } from 'react-i18next';
import { Copy, Play, SquarePen, Trash2 } from '@/presentation/components/icons';
import { Button } from '@/presentation/components/ui';
import type { StoredProject } from '@/lib/projectModel';

interface ProjectActionsProps {
  project: StoredProject;
  onOpen: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

// The action row. One brand primary CTA (Resume / View); secondary actions are ghost icon buttons. The
// whole row stays calm at rest and is revealed on hover/focus-within (opacity, never display:none, so it
// stays keyboard- and AT-reachable); on touch (no hover) it's always visible — see the parent's classes.
export const ProjectActions = ({ project, onOpen, onEdit, onDuplicate, onDelete }: ProjectActionsProps) => {
  const { t } = useTranslation('projects');
  const completed = project.status === 'completed';

  return (
    <div className="flex items-center gap-1.5">
      <Button size="sm" className="flex-1" onClick={onOpen}>
        <Play className="size-4 fill-current" />
        {completed ? t('actions.view') : t('actions.resume')}
      </Button>
      {completed && (
        <Button
          variant="ghost"
          size="sm"
          aria-label={t('actions.edit')}
          title={t('actions.edit')}
          className="text-muted-foreground hover:text-foreground"
          onClick={onEdit}
        >
          <SquarePen className="size-4" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        aria-label={t('actions.duplicate')}
        title={t('actions.duplicate')}
        className="text-muted-foreground hover:text-foreground"
        onClick={onDuplicate}
      >
        <Copy className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        aria-label={t('actions.delete')}
        title={t('actions.delete')}
        className="text-muted-foreground hover:text-[var(--color-error)]"
        onClick={onDelete}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
};
