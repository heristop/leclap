import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Film } from '@/presentation/components/icons';
import { useProjects } from '@/hooks/useProjects';
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
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import type { StoredProject } from '@/lib/projectModel';
import { ProjectCard } from './ProjectCard';
import { shelfLayout } from './projects-shelf.logic';

/** The shelf's anchor on the studio home: where old /projects links land (App.tsx). */
export const PROJECTS_ANCHOR = 'projects';

// The saved projects, on the studio home above the template gallery. The studio is where a video gets
// started and where it gets picked up again, so both live on one page instead of behind a Projects page
// of their own. One row of the most recent until the visitor asks for the rest; no section at all while
// there is nothing to resume, so a first visit opens straight on the templates. Every build saves here.
export const ProjectsShelf = () => {
  const { t } = useTranslation('projects');
  const navigate = useNavigate();
  const { hash } = useLocation();
  const { projects, remove, rename, duplicate } = useProjects();
  const [pendingDelete, setPendingDelete] = useState<StoredProject | null>(null);
  // Arriving by an old Projects link means the visitor came for the whole list.
  const deepLinked = hash === `#${PROJECTS_ANCHOR}`;
  const [expanded, setExpanded] = useState(deepLinked);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!deepLinked) return;

    sectionRef.current?.scrollIntoView({ block: 'start' });
  }, [deepLinked]);

  if (projects.length === 0) return null;

  // Open/edit navigate into the builder with a View Transition. We await the lazy Builder chunk so its
  // loading branch renders synchronously inside the transition (a Suspense fallback would be the snapshot,
  // leaving no title to morph into), and pass the project name through nav state so that loading branch
  // can show a `studio-title` target the card title morphs into. The project itself still hydrates from
  // `?projectId` — nav state carries only the title hint, never a template (which would seed builder state).
  const openProject = (project: StoredProject, edit: boolean) => {
    import('@/presentation/pages/Builder')
      .then(() =>
        navigate(`/studio/new?projectId=${project.id}${edit ? '&edit=1' : ''}`, {
          viewTransition: true,
          state: { projectTitle: project.name },
        })
      )
      .catch(() => {});
  };

  const duplicateProject = (project: StoredProject) => {
    duplicate(project.id).catch((error: unknown) => {
      logger.error('Duplicate failed', error);
    });
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

  const layout = shelfLayout(projects.length, expanded);

  return (
    <section
      ref={sectionRef}
      id={PROJECTS_ANCHOR}
      aria-labelledby="studio-projects"
      className="mb-12 scroll-mt-28 border-b border-foreground/10 pb-12"
    >
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2
            id="studio-projects"
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-300/80"
          >
            <Film aria-hidden="true" className="size-4" />
            {t('shelf.title')}
            <span className="text-gray-500">({projects.length})</span>
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{t('shelf.hint')}</p>
        </div>
        {layout.toggle !== 'none' && (
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={expanded}
            aria-controls="studio-projects-grid"
            onClick={() => {
              setExpanded((open) => !open);
            }}
            className={cn('shrink-0 text-brand-300 hover:text-brand-200', layout.toggle === 'narrow' && 'lg:hidden')}
          >
            {expanded ? t('shelf.showFewer') : t('shelf.showAll', { count: projects.length })}
          </Button>
        )}
      </div>

      <div id="studio-projects-grid" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {projects.map((project, index) => (
          <Reveal
            key={project.id}
            delay={(index % 4) * 60}
            className={cn(
              'h-full',
              index >= layout.hiddenBelowWideFrom && 'max-lg:hidden',
              index >= layout.hiddenFrom && 'hidden'
            )}
          >
            <ProjectCard
              project={project}
              onOpen={(target) => {
                openProject(target, false);
              }}
              onEdit={(target) => {
                openProject(target, true);
              }}
              onDuplicate={duplicateProject}
              onDelete={setPendingDelete}
              onRename={rename}
            />
          </Reveal>
        ))}
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
            <DialogDescription>{t('delete.message', { name: pendingDelete?.name })}</DialogDescription>
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
    </section>
  );
};
