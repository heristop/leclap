import { createContext, useContext, useRef, type RefObject } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { CopyPageButton } from '@/presentation/components/doc/CopyPageButton';
import { Eyebrow } from '@/presentation/components/doc/DocBlocks';
import { KineticHeading } from '@/presentation/components/kinetic';
import { DocMobileBar } from './doc-mobile-bar';
import { DocNavList } from './doc-nav-list';
import { DocPager } from './doc-pager';
import { DocTocRail } from './doc-toc';
import { useDocArrival } from './use-doc-arrival';
import { useDocToc } from './use-doc-toc';

// The rendered page, for the header's Copy-page button to serialise. The button lives in each page's
// header (beside the kicker) rather than on a row of its own, where it pushed every title down.
const DocContentContext = createContext<RefObject<HTMLElement | null> | null>(null);

// A page heading shared by every doc page — kicker and page actions, title, and an optional lead.
export const DocPageHeader = ({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children?: React.ReactNode;
}) => {
  const contentRef = useContext(DocContentContext);

  return (
    <header className="mb-12">
      <div className="mb-3 flex min-h-9 items-center justify-between gap-4">
        <Eyebrow kicker={kicker} />
        {contentRef ? <CopyPageButton contentRef={contentRef} /> : null}
      </div>
      {/* `outline-none`: arriving from another doc page moves focus here by script (useDocArrival), and
          a ring round the whole title would read as a selection. It is never a Tab stop. */}
      <KineticHeading text={title} as="h1" level="l" className="outline-none" />
      {/* A paragraph, not a div: the Copy-page export reads paragraphs, and a div lead never made it
          into the Markdown. */}
      {children ? <p className="mt-4 max-w-[33rem] text-[1.0625rem] leading-[1.7] text-gray-300">{children}</p> : null}
    </header>
  );
};

// The desktop sidebar, from `lg`. Below that the phone doc bar carries the same list. It scrolls on
// its own when a short window can't hold it, and the 6px of side padding (pulled back out by the
// negative margin, so nothing moves) is the room the focus outline needs: a scroll container clips
// whatever overhangs it, and the global ring sits 4px outside each link. Until `xl` the doc bar still
// pins the outline above it, so the sidebar sticks that much lower.
const DocSidebar = () => (
  <nav
    aria-label="Documentation"
    className="hidden lg:sticky lg:top-[8.25rem] lg:-mx-1.5 lg:block lg:max-h-[calc(100vh-9.25rem)] lg:self-start lg:overflow-y-auto lg:px-1.5 lg:pb-6 xl:top-28 xl:max-h-[calc(100vh-8rem)]"
  >
    <DocNavList />
  </nav>
);

export const DocLayout = () => {
  const { pathname } = useLocation();
  // The rendered doc content: serialised by Copy page, read for the "On this page" outline.
  const contentRef = useRef<HTMLDivElement>(null);
  const toc = useDocToc(contentRef, pathname);

  useDocArrival(contentRef, pathname);

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

      {/* xl widens the container for the third, "On this page" column instead of squeezing the
          reading column to make room for it. */}
      <div className="relative z-10 container mx-auto max-w-6xl px-4 pb-16 pt-24 lg:pt-28 xl:max-w-7xl">
        <DocMobileBar key={pathname} items={toc.items} activeId={toc.activeId} />
        {/* `grid-cols-1` is load-bearing: it resolves to `minmax(0, 1fr)`, whereas the implicit single
            column is `auto` and sizes to max-content — a wide table or code line would then stretch
            the column and push the whole page into horizontal scroll instead of scrolling itself. */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[13rem_minmax(0,1fr)] xl:grid-cols-[13rem_minmax(0,1fr)_12rem]">
          <DocSidebar />
          <div className="min-w-0">
            <DocContentContext value={contentRef}>
              {/* Keyed by route so each page replays a gentle enter. */}
              <div key={pathname} ref={contentRef} className="fade-in">
                <Outlet />
              </div>
            </DocContentContext>
            <DocPager />
          </div>
          <DocTocRail items={toc.items} activeId={toc.activeId} />
        </div>
      </div>
    </div>
  );
};
