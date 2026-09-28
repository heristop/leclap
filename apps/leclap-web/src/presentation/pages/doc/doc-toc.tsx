import { cn } from '@/lib/utils';
import { NAV_LABEL } from './doc-nav-list';
import type { TocItem } from './use-doc-toc';

interface TocListProps {
  items: readonly TocItem[];
  activeId: string | null;
  roomy?: boolean;
  onNavigate?: () => void;
}

const tocTextSize = (roomy: boolean, code: boolean): string => {
  if (roomy) return code ? 'font-mono text-[0.85rem]' : 'text-[0.95rem]';

  return code ? 'font-mono text-[0.72rem]' : 'text-[0.8rem]';
};

// The page's own outline as in-page anchors. The entry being read carries the same left-border mark
// as the current page in the sidebar, so "where am I" has one visual answer at both scales.
export const TocList = ({ items, activeId, roomy = false, onNavigate }: TocListProps) => (
  <ul className="border-l border-divider">
    {items.map((item) => {
      const active = item.id === activeId;

      return (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            onClick={onNavigate}
            aria-current={active ? 'location' : undefined}
            className={cn(
              '-ml-px block border-l-2 transition-colors duration-200 [overflow-wrap:anywhere]',
              roomy ? 'py-2.5' : 'py-1 leading-5',
              // Mono runs wide next to Oswald, so a code entry steps down a size to sit level with it.
              tocTextSize(roomy, item.code),
              item.level === 3 ? 'pl-7' : 'pl-4',
              active
                ? 'border-brand-400 text-foreground'
                : 'border-transparent text-gray-500 hover:border-brand-400/60 hover:text-foreground'
            )}
          >
            {item.label}
          </a>
        </li>
      );
    })}
  </ul>
);

// The desktop "On this page" rail, from `xl` where the reading column leaves room for a third one.
// A single-section page has nothing to navigate, so it gets no rail rather than a list of one. Like
// the sidebar, it pads its scroll box so the focus outline isn't clipped.
export const DocTocRail = ({ items, activeId }: { items: readonly TocItem[]; activeId: string | null }) => {
  if (items.length < 2) return null;

  return (
    <nav
      aria-labelledby="doc-toc-label"
      className="hidden xl:sticky xl:top-28 xl:-mx-1.5 xl:block xl:max-h-[calc(100vh-8rem)] xl:self-start xl:overflow-y-auto xl:px-1.5 xl:pb-6"
    >
      <p id="doc-toc-label" className={cn(NAV_LABEL, 'mb-3')}>
        On this page
      </p>
      <TocList items={items} activeId={activeId} />
    </nav>
  );
};
