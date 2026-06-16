import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { docNav } from './docNav';

const linkClass = (isActive: boolean): string =>
  `-ml-px block border-l-2 py-1 pl-4 text-sm transition-colors focus-visible:border-brand-400 focus-visible:text-foreground ${
    isActive
      ? 'border-brand-400 font-medium text-foreground'
      : 'border-transparent text-gray-400 hover:border-brand-400 hover:text-foreground'
  }`;

// Persistent docs nav. Vertical rail on desktop (sticky); on mobile it sits above the content so every
// page stays reachable.
const DocSidebar = () => (
  <nav aria-label="Documentation" className="lg:sticky lg:top-28 lg:self-start">
    <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-gray-500">Documentation</p>
    <ul className="space-y-1 border-l border-divider">
      {docNav.map((item) => (
        <li key={item.to}>
          <NavLink to={item.to} end={item.end} className={({ isActive }) => linkClass(isActive)}>
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
    <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h1>
    {children ? <div className="mt-3 max-w-[68ch] text-base leading-7 text-gray-300">{children}</div> : null}
  </header>
);

export const DocLayout = () => (
  <div className="min-h-[calc(100vh-4rem)] bg-background text-foreground">
    <div className="container mx-auto max-w-6xl px-4 pb-16 pt-24 lg:pt-28">
      <div className="grid gap-10 lg:grid-cols-[13rem_1fr]">
        <DocSidebar />
        <div className="min-w-0">
          <Outlet />
          <DocPager />
        </div>
      </div>
    </div>
  </div>
);
