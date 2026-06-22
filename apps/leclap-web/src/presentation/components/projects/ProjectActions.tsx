import { useTranslation } from 'react-i18next';
import { Trash2 } from '@/presentation/components/icons';
import { PlayIcon } from '@/presentation/components/icons/play';
import { CopyIcon } from '@/presentation/components/icons/copy';
import { SquarePenIcon } from '@/presentation/components/icons/square-pen';
import { useIconHover } from '@/presentation/components/icons/useIconHover';
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
  const { ref: playRef, hoverProps } = useIconHover();
  const { ref: copyRef, hoverProps: copyHoverProps } = useIconHover();
  const { ref: editRef, hoverProps: editHoverProps } = useIconHover();

  return (
    <div className="flex items-center gap-1.5">
      <Button size="sm" className="flex-1" onClick={onOpen} {...hoverProps}>
        <PlayIcon ref={playRef} size={16} className="[&_polygon]:fill-current" />
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
          {...editHoverProps}
        >
          <SquarePenIcon ref={editRef} size={16} />
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        aria-label={t('actions.duplicate')}
        title={t('actions.duplicate')}
        className="text-muted-foreground hover:text-foreground"
        onClick={onDuplicate}
        {...copyHoverProps}
      >
        <CopyIcon ref={copyRef} size={16} />
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
