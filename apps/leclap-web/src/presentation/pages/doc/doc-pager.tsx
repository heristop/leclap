import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from '@/presentation/components/icons';
import { cn } from '@/lib/utils';
import { docPager } from './doc-nav.logic';
import { docNav, type DocNavItem } from './docNav';

// The arrow leans the way the link goes; it is the only motion here and it says "this way".
const PagerLink = ({ item, direction }: { item: DocNavItem; direction: 'prev' | 'next' }) => {
  const next = direction === 'next';

  return (
    <Link
      to={item.to}
      className={cn(
        'group flex min-h-16 flex-col justify-center gap-1 rounded-2xl border border-divider bg-surface/40 px-5 py-4 transition-colors duration-200 hover:border-brand-400/60 hover:bg-surface',
        next && 'sm:col-start-2 sm:items-end sm:text-right'
      )}
    >
      <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
        {next ? null : (
          <ArrowLeft
            aria-hidden="true"
            className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5"
          />
        )}
        {next ? 'Next' : 'Previous'}
        {next ? (
          <ArrowRight
            aria-hidden="true"
            className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
          />
        ) : null}
      </span>
      <span className="font-medium text-foreground">{item.label}</span>
    </Link>
  );
};

// Prev / next derived from the docNav order, so the reader can walk the whole reference linearly —
// as two full cards, since a pair of small text links at the foot of a long page was easy to miss
// and hard to hit on a phone.
export const DocPager = () => {
  const { pathname } = useLocation();
  const { prev, next } = docPager(docNav, pathname);

  if (!prev && !next) return null;

  return (
    <nav aria-label="Previous and next page" className="mt-20 grid gap-3 border-t border-divider pt-8 sm:grid-cols-2">
      {prev ? <PagerLink item={prev} direction="prev" /> : null}
      {next ? <PagerLink item={next} direction="next" /> : null}
    </nav>
  );
};
