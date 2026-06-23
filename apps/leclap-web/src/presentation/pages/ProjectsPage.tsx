import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FolderOpenIcon } from '@/presentation/components/icons/folder-open';
import { PlusIcon } from '@/presentation/components/icons/plus';
import { useIconHover } from '@/presentation/components/icons/useIconHover';
import { useProjects } from '@/hooks/useProjects';
import { ProjectCard } from '@/presentation/components/projects/ProjectCard';
import { StudioSurface } from '@/presentation/components/StudioSurface';
import { EmptyState } from '@/presentation/components/EmptyState';
import { Seo } from '@/presentation/components/Seo';
import {
  Button,
  Reveal,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/presentation/components/ui';
import { logger } from '@/lib/logger';
import type { StoredProject } from '@/lib/projectModel';

export const ProjectsPage = () => {
  const { t } = useTranslation('projects');
  const navigate = useNavigate();
  const { projects, remove, rename, duplicate } = useProjects();
  const [pendingDelete, setPendingDelete] = useState<StoredProject | null>(null);
  const { ref: plusRef, hoverProps: plusHoverProps } = useIconHover();

  const openProject = (project: StoredProject) => {
    Promise.resolve(navigate(`/studio/new?projectId=${project.id}`)).catch(() => {});
  };

  const editProject = (project: StoredProject) => {
    Promise.resolve(navigate(`/studio/new?projectId=${project.id}&edit=1`)).catch(() => {});
  };

  const duplicateProject = (project: StoredProject) => {
    duplicate(project.id).catch((error: unknown) => {
      logger.error('Duplicate failed', error);
    });
  };

  const startNew = () => {
    Promise.resolve(navigate('/studio')).catch(() => {});
  };

  const confirmDelete = () => {
    const target = pendingDelete;
    setPendingDelete(null);

    if (target) {
      remove(target.id).catch((error: unknown) => {
        logger.error('Delete failed', error);
      });
    }
  };

  return (
    <StudioSurface
      kicker={t('kicker')}
      title={t('title')}
      subtitle={t('subtitle')}
      actions={
        <Button onClick={startNew} className="active:scale-[0.98]" {...plusHoverProps}>
          <PlusIcon ref={plusRef} size={16} /> {t('actions.new')}
        </Button>
      }
    >
      <Seo title={t('seo.title')} description={t('seo.description')} path="/projects" />

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderOpenIcon}
          title={t('empty.title')}
          hint={t('empty.hint')}
          action={{ label: t('actions.new'), onClick: startNew }}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projects.map((project, index) => (
            <Reveal key={project.id} delay={index * 60} className="h-full">
              <ProjectCard
                project={project}
                onOpen={openProject}
                onEdit={editProject}
                onDuplicate={duplicateProject}
                onDelete={setPendingDelete}
                onRename={rename}
              />
            </Reveal>
          ))}
        </div>
      )}

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('delete.title')}</DialogTitle>
            <DialogDescription>{t('delete.message', { name: pendingDelete?.templateName })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setPendingDelete(null);
              }}
            >
              {t('delete.cancel')}
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              {t('delete.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StudioSurface>
  );
};
