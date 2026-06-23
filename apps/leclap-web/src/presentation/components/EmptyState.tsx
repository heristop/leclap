import { type ForwardRefExoticComponent, type RefAttributes } from 'react';
import { useIconHover, type AnimatedIconHandle } from '@/presentation/components/icons/useIconHover';
import { Button } from '@/presentation/components/ui';

interface EmptyStateProps {
  icon: ForwardRefExoticComponent<{ className?: string } & RefAttributes<AnimatedIconHandle>>;
  title: string;
  hint?: string;
  action?: { label: string; onClick: () => void };
}

// Shared empty/no-results state: a dashed panel with an icon, title, hint, and optional action.
export const EmptyState = ({ icon: Icon, title, hint, action }: EmptyStateProps) => {
  const { ref, hoverProps } = useIconHover();

  return (
    <div
      className="fade-in flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-foreground/15 bg-surface/30 px-6 py-14 text-center"
      {...hoverProps}
    >
      <div className="relative">
        {/* Pulsing brand halo behind the icon. */}
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/25 blur-2xl animate-glow"
        />
        <span className="relative grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
          <Icon className="h-6 w-6" ref={ref} />
        </span>
      </div>
      <p className="font-display text-lg font-semibold text-foreground">{title}</p>
      {hint && <p className="max-w-sm text-sm text-gray-400">{hint}</p>}
      {action && (
        <Button variant="ghost" size="sm" onClick={action.onClick} className="mt-1">
          {action.label}
        </Button>
      )}
    </div>
  );
};
