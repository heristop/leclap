import { cn } from '@/lib/utils';

// A gradient "snake" that races once around its host's rounded border, then fades — a motion flourish
// to punctuate a menu/selection change. Mount inside a `relative`, rounded host (the radius inherits)
// and REMOUNT it (a changing React `key`) to replay. CSS-driven (`snake-border` in index.css) and
// hidden under prefers-reduced-motion, so there's no JS animation to gate here.
export function SnakeBorder({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('snake-border', className)} />;
}

export default SnakeBorder;
