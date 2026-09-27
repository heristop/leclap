import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Pencil, Trash2, Braces, Scissors } from '@/presentation/components/icons';
import { ArrowRightIcon } from '@/presentation/components/icons/arrow-right';
import { PlusIcon } from '@/presentation/components/icons/plus';
import { SparklesIcon } from '@/presentation/components/icons/sparkles';
import { FolderOpenIcon } from '@/presentation/components/icons/folder-open';
import { GithubIcon } from '@/presentation/components/icons/github';
import { Button, Reveal } from '@/presentation/components/ui';
import { useIconHover } from '@/presentation/components/icons/useIconHover';
import type { Template } from '@/services/templateService';
import { REPO_URL } from '@/config/site';
import { StudioSurface } from '@/presentation/components/StudioSurface';
import { KineticHeading } from '@/presentation/components/kinetic';
import { Seo } from '@/presentation/components/Seo';
import {
  CardIconAction,
  DuplicateButton,
  EmptyLibrary,
  LIBRARY_GRID,
  LibraryError,
  LibraryLinkCard,
  LibrarySectionHeading,
  LibrarySkeleton,
  TemplateCard,
} from '@/presentation/components/admin/template-library-parts';
import { ConfirmDialog } from '@/presentation/components/admin/confirm-dialog';
import { ShareTemplateDialog } from '@/presentation/components/admin/share-template-dialog';
import { useTemplateLibrary } from '@/presentation/components/admin/use-template-library';

type AdminT = TFunction<'admin'>;

// Stagger within a row (three columns at desktop), not across the whole list: a card scrolled into
// view deep in a long library appears at once instead of waiting its index × 70 ms turn.
const rowDelay = (index: number): number => (index % 3) * 70;

// Mark this card's title as the View Transition's shared element so it morphs into the editor titlebar
// when the template editor opens. Called from the edit link's click: walk up to the card, then tag its
// title — set imperatively at click time so the name is on the DOM before the snapshot.
const tagTitleForTransition = (link: HTMLElement): void => {
  const title = link.closest('[data-vt-card]')?.querySelector<HTMLElement>('[data-vt-title]');

  if (title) title.style.viewTransitionName = 'studio-title';
};

// Warm the lazy editor chunk so the destination renders synchronously inside the transition — a
// Suspense fallback would be the snapshot, leaving no title to morph into. On hover and on focus, so
// keyboard users get the same morph.
const warmEditor = (): void => {
  import('@/presentation/pages/TemplateEditorPage').catch(() => {});
};

const HeaderActions = ({ t }: { t: AdminT }) => {
  const { ref: studioRef, hoverProps: studioHoverProps } = useIconHover();
  const { ref: createRef, hoverProps: createHoverProps } = useIconHover();

  return (
    <>
      <Button asChild variant="outline" size="sm" className="active:scale-[0.98]">
        <Link to="/studio" {...studioHoverProps}>
          {t('page.goToBuilder')} <ArrowRightIcon ref={studioRef} size={16} />
        </Link>
      </Button>
      <Button asChild className="active:scale-[0.98]" {...createHoverProps}>
        <Link to="/templates/new">
          <PlusIcon ref={createRef} size={16} /> {t('page.create')}
        </Link>
      </Button>
    </>
  );
};

interface RowActions {
  onConvert: (template: Template) => void;
  onShare: (template: Template) => void;
  onDelete: (template: Template) => void;
}

// A user template's actions: Edit leads; convert, share and delete are icon buttons named by tooltip,
// delete last and in red on hover.
const UserCardActions = ({
  template,
  t,
  onConvert,
  onShare,
  onDelete,
}: { template: Template; t: AdminT } & RowActions) => (
  <>
    <Button asChild variant="secondary" size="sm" className="min-h-10 flex-1 active:scale-[0.98]">
      <Link
        to={`/templates/${template.id}/edit`}
        viewTransition
        onMouseEnter={warmEditor}
        onFocus={warmEditor}
        onClick={(event) => {
          tagTitleForTransition(event.currentTarget);
        }}
      >
        <Pencil /> {t('card.edit')}
      </Link>
    </Button>
    <CardIconAction
      label={t('card.convertToPartial', { name: template.name })}
      onClick={() => {
        onConvert(template);
      }}
    >
      <Scissors />
    </CardIconAction>
    <CardIconAction
      label={t('card.share', { name: template.name })}
      onClick={() => {
        onShare(template);
      }}
    >
      <GithubIcon className="size-4" />
    </CardIconAction>
    <CardIconAction
      destructive
      label={t('card.delete', { name: template.name })}
      onClick={() => {
        onDelete(template);
      }}
    >
      <Trash2 />
    </CardIconAction>
  </>
);

const MyTemplates = ({ mine, t, ...actions }: { mine: Template[]; t: AdminT } & RowActions) => (
  <section aria-labelledby="my-templates" className="mb-14 scroll-mt-24">
    <LibrarySectionHeading
      id="my-templates"
      icon={FolderOpenIcon}
      label={t('page.myTemplates')}
      count={mine.length > 0 ? t('page.count', { count: mine.length }) : undefined}
    />
    {mine.length === 0 ? (
      <EmptyLibrary />
    ) : (
      <div className={LIBRARY_GRID}>
        {mine.map((tpl, index) => (
          <Reveal key={tpl.id} delay={rowDelay(index)} className="h-full">
            <TemplateCard template={tpl} t={t} actions={<UserCardActions template={tpl} t={t} {...actions} />} />
          </Reveal>
        ))}
      </div>
    )}
  </section>
);

type SamplesProps = {
  samples: Template[];
  status: ReturnType<typeof useTemplateLibrary>['status'];
  onRetry: () => void;
  onDuplicate: (template: Template) => void;
  t: AdminT;
};

const SampleTemplates = ({ samples, status, onRetry, onDuplicate, t }: SamplesProps) => (
  <section aria-labelledby="sample-templates" aria-busy={status === 'loading'} className="scroll-mt-24">
    <LibrarySectionHeading id="sample-templates" icon={SparklesIcon} label={t('page.samples')} />
    {status === 'loading' && <LibrarySkeleton />}
    {status === 'error' && (
      <LibraryError message={t('page.samplesError')} retryLabel={t('page.retry')} onRetry={onRetry} />
    )}
    {status === 'ready' && (
      <div className={LIBRARY_GRID}>
        {samples.map((tpl, index) => (
          <Reveal key={tpl.id} delay={rowDelay(index)} className="h-full">
            <TemplateCard
              template={tpl}
              t={t}
              actions={
                <DuplicateButton
                  label={t('card.duplicate')}
                  onClick={() => {
                    onDuplicate(tpl);
                  }}
                />
              }
            />
          </Reveal>
        ))}
      </div>
    )}
  </section>
);

// The template library (/templates): the author's own templates, the samples to duplicate, then the
// way out to partials and to GitHub. Destructive and outbound actions confirm in a dialog first.
export const Admin = () => {
  const { t } = useTranslation('admin');
  const library = useTemplateLibrary();
  const [converting, setConverting] = useState<Template | null>(null);
  const [sharing, setSharing] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState<Template | null>(null);
  const { ref: githubRef, hoverProps: githubHoverProps } = useIconHover();

  return (
    <StudioSurface
      title={t('page.heading')}
      kicker={t('page.kicker')}
      titleSlot={<KineticHeading text={t('page.heading')} level="l" as="h1" uppercase />}
      subtitle={t('page.subtitle')}
      actions={<HeaderActions t={t} />}
    >
      <Seo title={t('seo.library')} path="/templates" noindex />

      <MyTemplates mine={library.mine} t={t} onConvert={setConverting} onShare={setSharing} onDelete={setDeleting} />
      <SampleTemplates
        samples={library.samples}
        status={library.status}
        onRetry={library.retry}
        onDuplicate={library.duplicate}
        t={t}
      />

      <div className="mt-14 grid gap-4 md:grid-cols-2">
        <LibraryLinkCard
          to="/partials"
          icon={<Braces className="size-5" />}
          title={t('page.partials')}
          description={t('page.partialsHint')}
        />
        <LibraryLinkCard
          href={REPO_URL}
          hoverProps={githubHoverProps}
          icon={<GithubIcon ref={githubRef} className="size-5" />}
          title={t('page.contribute.title')}
          description={t('page.contribute.description')}
        />
      </div>

      <ConfirmDialog
        tone="primary"
        open={converting !== null}
        title={t('card.convertDialog.title')}
        description={t('card.convertDialog.description', { name: converting?.name ?? '' })}
        cancelLabel={t('card.convertDialog.cancel')}
        confirmLabel={t('card.convertDialog.confirm')}
        onConfirm={() => {
          if (converting) library.convertToPartial(converting);
          setConverting(null);
        }}
        onCancel={() => {
          setConverting(null);
        }}
      />
      <ShareTemplateDialog
        template={sharing}
        onClose={() => {
          setSharing(null);
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title={t('card.deleteDialog.title')}
        description={t('card.deleteDialog.description', { name: deleting?.name ?? '' })}
        cancelLabel={t('card.deleteDialog.cancel')}
        confirmLabel={t('card.deleteDialog.confirm')}
        onConfirm={() => {
          if (deleting) library.remove(deleting);
          setDeleting(null);
        }}
        onCancel={() => {
          setDeleting(null);
        }}
        focusFallback={() => document.getElementById('my-templates')}
      />
    </StudioSurface>
  );
};
