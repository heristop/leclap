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

// The action row: one quiet, always-visible action (Resume / View) — the studio shows several cards in a
// row, and a gradient button on each would shout — and the secondary actions as ghost icon buttons. Those
// wait for a hover or focus-within where there is a fine pointer (opacity, never display:none, so they stay
// keyboard- and AT-reachable), and always show on touch, where there's no hover to wait for.
export const ProjectActions = ({ project, onOpen, onEdit, onDuplicate, onDelete }: ProjectActionsProps) => {
  const { t } = useTranslation('projects');
  const completed = project.status === 'completed';
  const { ref: playRef, hoverProps } = useIconHover();
  const { ref: copyRef, hoverProps: copyHoverProps } = useIconHover();
  const { ref: editRef, hoverProps: editHoverProps } = useIconHover();

  return (
    <div className="flex items-center gap-1.5">
      <Button size="sm" variant="secondary" className="flex-1" onClick={onOpen} {...hoverProps}>
        <PlayIcon ref={playRef} size={16} className="[&_polygon]:fill-current" />
        {completed ? t('actions.view') : t('actions.resume')}
      </Button>
      <div className="flex items-center gap-0.5 transition-opacity duration-200 pointer-fine:opacity-0 pointer-fine:group-hover/card:opacity-100 pointer-fine:group-focus-within/card:opacity-100 motion-reduce:transition-none">
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
    </div>
  );
};
