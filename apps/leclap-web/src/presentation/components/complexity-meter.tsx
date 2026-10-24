import { cn } from '@/lib/utils';
import type { Template } from '@/services/templateService';

const LEVEL: Record<Template['complexity'], number> = { simple: 1, intermediate: 2, advanced: 3 };

// A template's complexity as three rising bars, the same marks as the studio's complexity filter, with
// its word beside them. The lit bars run the brand gradient.
export const ComplexityMeter = ({
  complexity,
  label,
  className,
}: {
  complexity: Template['complexity'];
  label: string;
  className?: string;
}) => (
  <span className={cn('inline-flex items-center gap-2', className)}>
    <span aria-hidden className="flex h-3.5 items-end gap-[3px]">
      {[1, 2, 3].map((bar) => (
        <span
          key={bar}
          className={cn(
            'w-1 rounded-full',
            bar <= LEVEL[complexity] ? 'bg-linear-to-t from-brand-500 to-secondary-400' : 'bg-foreground/15'
          )}
          style={{ height: `${40 + (bar - 1) * 30}%` }}
        />
      ))}
    </span>
    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
  </span>
);
