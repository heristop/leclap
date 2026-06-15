import type { LucideIcon } from 'lucide-react';
import { Button } from '@/presentation/components/ui';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: { label: string; onClick: () => void };
}

// Shared empty/no-results state: a dashed panel with an icon, title, hint, and optional action.
export const EmptyState = ({ icon: Icon, title, hint, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-foreground/15 bg-surface/30 px-6 py-14 text-center">
    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
      <Icon className="h-6 w-6" />
    </span>
    <p className="font-display text-lg font-semibold text-foreground">{title}</p>
    {hint && <p className="max-w-sm text-sm text-gray-400">{hint}</p>}
    {action && (
      <Button variant="ghost" size="sm" onClick={action.onClick} className="mt-1">
        {action.label}
      </Button>
    )}
  </div>
);
