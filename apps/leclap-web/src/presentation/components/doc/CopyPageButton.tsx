// Remotion-style "Copy page" split button for the docs reader. The main segment copies the current
// page as Markdown; the chevron opens a list of ways to take the page elsewhere (raw Markdown, an AI
// assistant, or an MCP install). Doc pages are JSX with no Markdown source, so everything is generated
// from the live DOM under `contentRef` at click time.
//
// The list is a disclosure, not an ARIA menu: `role="menu"` promises arrow-key roving focus that this
// never had. Plain buttons in tab order after the toggle, Escape back to it, and closing as focus or
// a click leaves the widget, so it can't stay open over the page title once the reader has moved on.
import { useEffect, useId, useRef, useState, type ComponentType } from 'react';
import { ArrowUpRight, Check } from 'lucide-react';
import { CopyIcon } from '@/presentation/components/icons/copy';
import { ChevronDownIcon } from '@/presentation/components/icons/chevron-down';
import { useIconHover } from '@/presentation/components/icons/useIconHover';
import { cn } from '@/lib/utils';
import { aiChatUrl, mcpInstallUrl, pageMarkdown, pageTitle } from './docMarkdown';
import { ChatGptMark, ClaudeMark, CursorMark, MarkdownMark, VscodeMark } from './docMenuIcons';
import { useCopyFlash } from './use-copy-flash';

interface CopyPageButtonProps {
  // The rendered doc content to serialise (the wrapper around the route's <Outlet/>).
  contentRef: React.RefObject<HTMLElement | null>;
}

interface MenuItem {
  key: string;
  Icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  external?: boolean;
  run: (ctx: { root: HTMLElement; url: string; title: string; markdown: string }) => void;
}

const openExternal = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

const MENU: MenuItem[] = [
  {
    key: 'copy',
    Icon: MarkdownMark,
    title: 'Copy page',
    subtitle: 'Copy this page as Markdown',
    run: () => {
      // Handled by the shared copy path so it can flash the checkmark.
    },
  },
  {
    key: 'view',
    Icon: MarkdownMark,
    title: 'View as Markdown',
    subtitle: 'Open this page in Markdown',
    run: ({ markdown }) => {
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      openExternal(url);
      // The new tab has loaded by now; reclaim the object URL.
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 10_000);
    },
  },
  {
    key: 'chatgpt',
    Icon: ChatGptMark,
    title: 'Open in ChatGPT',
    subtitle: 'Ask questions about this page',
    external: true,
    run: ({ title, url, markdown }) => openExternal(aiChatUrl('chatgpt', title, url, markdown)),
  },
  {
    key: 'claude',
    Icon: ClaudeMark,
    title: 'Open in Claude',
    subtitle: 'Ask questions about this page',
    external: true,
    run: ({ title, url, markdown }) => openExternal(aiChatUrl('claude', title, url, markdown)),
  },
  {
    key: 'cursor',
    Icon: CursorMark,
    title: 'Connect to Cursor',
    subtitle: 'Install the LeClap MCP server',
    external: true,
    run: () => openExternal(mcpInstallUrl('cursor')),
  },
  {
    key: 'vscode',
    Icon: VscodeMark,
    title: 'Connect to VS Code',
    subtitle: 'Install the LeClap MCP server',
    external: true,
    run: () => openExternal(mcpInstallUrl('vscode')),
  },
];

export const CopyPageButton = ({ contentRef }: CopyPageButtonProps) => {
  const [open, setOpen] = useState(false);
  const { copied, copy } = useCopyFlash();
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const { ref: copyRef, hoverProps: copyHoverProps } = useIconHover();
  const { ref: chevronRef, hoverProps: chevronHoverProps } = useIconHover();

  useEffect(() => {
    if (!open) return () => {};

    const onPointer = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;

      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      setOpen(false);
      toggleRef.current?.focus();
    };

    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Snapshot the live page each time, so the action always reflects the current route.
  const snapshot = () => {
    const root = contentRef.current;

    if (!root) return null;

    const url = window.location.href;

    return { root, url, title: pageTitle(root), markdown: pageMarkdown(root, url) };
  };

  const copyPage = () => {
    const ctx = snapshot();

    if (!ctx) return;

    copy(ctx.markdown);
  };

  const runItem = (item: MenuItem) => {
    setOpen(false);

    if (item.key === 'copy') {
      copyPage();

      return;
    }

    const ctx = snapshot();

    if (!ctx) return;

    item.run(ctx);
  };

  return (
    <div
      className="relative shrink-0"
      ref={rootRef}
      onBlur={(event) => {
        if (rootRef.current?.contains(event.relatedTarget)) return;

        setOpen(false);
      }}
    >
      {/* Split button: a Copy segment + a chevron toggle sharing one rounded border. */}
      <div className="inline-flex items-stretch overflow-hidden rounded-xl border border-divider bg-surface-2 text-sm font-medium text-foreground shadow-sm">
        <button
          type="button"
          onClick={copyPage}
          className="tap inline-flex min-h-9 items-center gap-2 px-3 py-1.5 transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/50"
          {...copyHoverProps}
        >
          {copied ? <Check className="h-4 w-4 text-success pop-in" /> : <CopyIcon ref={copyRef} size={16} />}
          <span>{copied ? 'Copied' : 'Copy page'}</span>
        </button>
        <span aria-hidden className="w-px self-stretch bg-divider" />
        <button
          ref={toggleRef}
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          aria-label="More page actions"
          onClick={() => {
            setOpen((v) => !v);
          }}
          className="tap inline-flex min-w-9 items-center justify-center px-2 transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/50"
          {...chevronHoverProps}
        >
          <ChevronDownIcon
            ref={chevronRef}
            size={16}
            className={cn('text-gray-400 transition-transform duration-200', open && 'rotate-180')}
          />
        </button>
      </div>
      <span role="status" className="sr-only">
        {copied ? 'Page copied as Markdown' : ''}
      </span>

      {open && (
        // Focusable by click only (-1), so a click on the list's own padding keeps focus inside the
        // widget instead of dropping it to <body> — which the blur handler would read as leaving.
        <div
          id={listId}
          tabIndex={-1}
          className="absolute right-0 z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-divider bg-surface p-1.5 shadow-[var(--shadow-lg)] outline-none"
        >
          {MENU.map((item) => {
            const { Icon } = item;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  runItem(item);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-brand-500/10 focus-visible:bg-brand-500/10"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-divider bg-surface-2 text-foreground">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-sm font-semibold text-foreground">
                    {item.title}
                    {item.external ? (
                      <>
                        <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5 text-gray-400" />
                        <span className="sr-only"> (external)</span>
                      </>
                    ) : null}
                  </span>
                  <span className="block truncate text-xs text-gray-400">{item.subtitle}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
