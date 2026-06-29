import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Clapperboard, Loader2 } from '@/presentation/components/icons';

// A lightweight stand-in for EditorShell shown while a project hydrates from `?projectId`. It mirrors
// EditorTopBar's fixed top bar (back affordance + brand chip + title) at the SAME position, so the
// `studio-title` View Transition from the project card lands on the title in its final spot — then the
// real EditorShell mounts in the identical place and takes over with no jump. Body shows the spinner.
export const EditorLoadingShell = ({ title }: { title: string }) => {
  const { t } = useTranslation('builder');

  return createPortal(
    <div className="dark fixed inset-x-0 bottom-0 top-16 z-30 flex flex-col bg-background text-foreground">
      <header className="flex items-center gap-2.5 border-b border-foreground/10 bg-surface-2/70 px-4 py-2.5 shadow-[inset_0_1px_0_0_oklch(1_0_0/0.04)] backdrop-blur-md sm:px-6">
        {/* Non-interactive stand-ins for the back pill + divider + chip — they only reserve the same
            width so the title starts at the exact x-position EditorTopBar gives it. */}
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-sm font-medium text-muted-foreground">
          <ChevronLeft size={16} />
          <span className="hidden sm:inline">{t('hub.changeTemplate')}</span>
        </span>
        <span aria-hidden="true" className="h-5 w-px shrink-0 bg-foreground/15" />
        <span
          aria-hidden="true"
          className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-500/15 text-brand-500 ring-1 ring-brand-500/20"
        >
          <Clapperboard className="size-4" />
        </span>
        <p
          style={{ viewTransitionName: 'studio-title' }}
          className="min-w-0 flex-1 truncate font-display text-base font-bold tracking-tight text-foreground"
        >
          {title}
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-gray-400">
        <Loader2 className="h-7 w-7 animate-spin text-brand-500 motion-reduce:animate-none" />
        <p className="text-sm font-medium">{t('project.loading')}</p>
      </div>
    </div>,
    document.body
  );
};
