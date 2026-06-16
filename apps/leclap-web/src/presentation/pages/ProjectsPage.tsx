import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FolderOpen, Plus } from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { ProjectCard } from '@/presentation/components/projects/ProjectCard';
import { EmptyState } from '@/presentation/components/EmptyState';
import { Seo } from '@/presentation/components/Seo';
import {
  Badge,
  Button,
  Reveal,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/presentation/components/ui';
import type { StoredProject } from '@/lib/projectModel';

export const ProjectsPage = () => {
  const { t } = useTranslation('projects');
  const navigate = useNavigate();
  const { projects, remove, rename, duplicate } = useProjects();
  const [pendingDelete, setPendingDelete] = useState<StoredProject | null>(null);

  const openProject = (project: StoredProject) => {
    Promise.resolve(navigate(`/builder?projectId=${project.id}`)).catch(() => {});
  };

  const editProject = (project: StoredProject) => {
    Promise.resolve(navigate(`/builder?projectId=${project.id}&edit=1`)).catch(() => {});
  };

  const duplicateProject = (project: StoredProject) => {
    duplicate(project.id).catch((error: unknown) => {
      console.error('Duplicate failed', error);
    });
  };

  const startNew = () => {
    Promise.resolve(navigate('/builder')).catch(() => {});
  };

  const confirmDelete = () => {
    const target = pendingDelete;
    setPendingDelete(null);

    if (target) {
      remove(target.id).catch((error: unknown) => {
        console.error('Delete failed', error);
      });
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background text-foreground">
      <Seo title={t('seo.title')} description={t('seo.description')} path="/projects" />

      <div className="border-b border-divider bg-surface/40">
        <div className="container mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-4 pt-28 pb-10">
          <div>
            <Badge variant="brand">
              <FolderOpen className="mr-1 h-3.5 w-3.5" /> {t('kicker')}
            </Badge>
            <h1 className="mt-4 font-display text-[length:var(--text-display-sm)] font-bold tracking-tight text-foreground">
              {t('title')}
            </h1>
            <p className="mt-2 max-w-[56ch] text-base leading-7 text-gray-400">{t('subtitle')}</p>
          </div>
          <Button onClick={startNew}>
            <Plus className="h-4 w-4" /> {t('actions.new')}
          </Button>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4 py-12">
        {projects.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title={t('empty.title')}
            hint={t('empty.hint')}
            action={{ label: t('actions.new'), onClick: startNew }}
          />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
      </div>

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
    </div>
  );
};
