import { useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from '@/presentation/components/icons';
import { CopyPageButton } from '@/presentation/components/doc/CopyPageButton';
import { KineticHeading } from '@/presentation/components/kinetic';
import { docNav } from './docNav';

// Two shapes for one nav, no duplicated markup: a horizontally scrolling chip rail on phones, the
// bordered vertical rail from `lg`. Stacked, these twelve links cost roughly 430px — so every doc
// page opened on a wall of navigation and the first sentence of the actual reference started below
// the fold. Scrolling them sideways keeps all twelve one tap away in the height of a single row.
const linkClass = (isActive: boolean): string =>
  [
    'block shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-sm transition-all duration-300 ease-[var(--ease-out-expo)]',
    'lg:-ml-px lg:shrink lg:whitespace-normal lg:rounded-none lg:border-l-2 lg:px-0 lg:py-1 lg:pl-4',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 lg:focus-visible:border-brand-400 lg:focus-visible:text-foreground',
    isActive
      ? 'bg-brand-500/15 font-medium text-foreground ring-1 ring-brand-500/30 lg:translate-x-0.5 lg:border-brand-400 lg:bg-transparent lg:ring-0'
      : 'text-gray-400 hover:text-foreground lg:border-transparent lg:hover:translate-x-0.5 lg:hover:border-brand-400/60',
  ].join(' ');

const DocSidebar = () => (
  <nav aria-label="Documentation" className="lg:sticky lg:top-28 lg:self-start">
    <p className="mb-3 hidden text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-gray-500 lg:block">
      Documentation
    </p>
    {/* The rail scrolls inside the container: a negative-margin edge bleed here widens the grid past
        the viewport and puts the whole doc page into horizontal scroll. */}
    <ul className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] lg:block lg:space-y-1 lg:overflow-visible lg:border-l lg:border-divider [&::-webkit-scrollbar]:hidden">
      {docNav.map((item) => (
        <li key={item.to} className="shrink-0">
          <NavLink to={item.to} end={item.end} viewTransition className={({ isActive }) => linkClass(isActive)}>
            {item.label}
          </NavLink>
        </li>
      ))}
    </ul>
  </nav>
);

// Prev / next links derived from the docNav order, so the reader can walk the whole reference linearly.
const DocPager = () => {
  const { pathname } = useLocation();
  const index = docNav.findIndex((item) => item.to === pathname);

  if (index === -1) return null;

  const prev = index > 0 ? docNav[index - 1] : null;
  const next = index < docNav.length - 1 ? docNav[index + 1] : null;

  return (
    <nav aria-label="Pagination" className="mt-16 flex items-center justify-between gap-4 border-t border-divider pt-6">
      {prev ? (
        <NavLink
          to={prev.to}
          viewTransition
          className="inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {prev.label}
        </NavLink>
      ) : (
        <span />
      )}
      {next ? (
        <NavLink
          to={next.to}
          viewTransition
          className="inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-foreground"
        >
          {next.label} <ArrowRight className="h-4 w-4" />
        </NavLink>
      ) : (
        <span />
      )}
    </nav>
  );
};

// A page heading shared by every doc page — kicker, title, and an optional lead paragraph.
export const DocPageHeader = ({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children?: React.ReactNode;
}) => (
  <header className="mb-8">
    <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-brand-500/90">{kicker}</p>
    <KineticHeading text={title} as="h1" level="m" />
    {children ? <div className="mt-3 max-w-[68ch] text-base leading-7 text-gray-300">{children}</div> : null}
  </header>
);

export const DocLayout = () => {
  // Key the content by route so it replays a gentle enter on each doc-page navigation.
  const { pathname } = useLocation();
  // The rendered doc content, handed to the Copy-page button to serialise into Markdown.
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    // `relative` (not `overflow-hidden`) on the root: an overflow-hidden ancestor would break the
    // sidebar's `lg:sticky`. The ambient blobs are clipped inside their own absolute wrapper instead.
    <div className="relative min-h-[calc(100vh-4rem)] bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-brand-500/10 blur-[120px] animate-float" />
        <div
          className="absolute bottom-1/4 left-0 h-96 w-96 rounded-full bg-secondary-400/10 blur-[120px] animate-float"
          style={{ animationDelay: '-3s' }}
        />
      </div>

      <div className="relative z-10 container mx-auto max-w-6xl px-4 pb-16 pt-24 lg:pt-28">
        {/* `grid-cols-1` is load-bearing: it resolves to `minmax(0, 1fr)`, whereas the implicit
            single column is `auto` and sizes to max-content — which the horizontally scrolling nav
            rail would then stretch to the width of all twelve chips, pushing the whole page into
            horizontal scroll instead of scrolling inside itself. */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[13rem_1fr]">
          <DocSidebar />
          <div className="min-w-0">
            <div className="mb-4 flex justify-end">
              <CopyPageButton contentRef={contentRef} />
            </div>
            <div key={pathname} ref={contentRef} className="fade-in">
              <Outlet />
            </div>
            <DocPager />
          </div>
        </div>
      </div>
    </div>
  );
};
