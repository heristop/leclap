// The Generate-with-AI panel's frame: a pinned header (title, subtitle, close), a body that is the
// only thing that scrolls, and a pinned footer for the run's status and primary action. The body
// scrolls inside the rounded panel (never the page or the panel itself), so its scrollbar sits
// between the two bars and a focused field can never hide under the footer. A hairline and a soft
// shadow appear on a bar only while content is scrolled under it. ⌘/Ctrl+Enter runs `onSubmit`.
import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/presentation/components/ui';

interface AiDialogFrameProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  footer: ReactNode;
  children: ReactNode;
  // The keyboard shortcut's action (⌘/Ctrl+Enter), or undefined while it has nothing to do.
  onSubmit?: () => void;
}

type Edges = { top: boolean; bottom: boolean };

const noop = (): void => {};

// Whether content is hidden above / below the scroll body, kept current on scroll and resize.
function useScrollEdges(): [Edges, (node: HTMLDivElement | null) => void] {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [under, setUnder] = useState({ top: false, bottom: false });

  useEffect(() => {
    if (!node) return noop;

    const measure = (): void => {
      const top = node.scrollTop > 1;
      const bottom = node.scrollTop + node.clientHeight < node.scrollHeight - 1;
      setUnder((prev) => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);

    for (const child of node.children) observer.observe(child);

    node.addEventListener('scroll', measure, { passive: true });
    measure();

    return () => {
      observer.disconnect();
      node.removeEventListener('scroll', measure);
    };
  }, [node]);

  return [under, setNode];
}

function isSubmitShortcut(event: KeyboardEvent): boolean {
  return event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing;
}

const BAR = 'relative z-10 shrink-0 border-transparent transition-[border-color,box-shadow] duration-200';

export const AiDialogFrame = ({ open, onClose, title, subtitle, footer, children, onSubmit }: AiDialogFrameProps) => {
  const [under, trackScroll] = useScrollEdges();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0"
        onKeyDown={(event) => {
          if (!isSubmitShortcut(event) || !onSubmit) return;

          event.preventDefault();
          onSubmit();
        }}
      >
        <header
          className={cn(
            BAR,
            'grid gap-1 border-b px-5 pb-4 pt-5 sm:px-6 sm:pt-6',
            under.top && 'border-divider shadow-[0_6px_12px_-10px_oklch(0_0_0/0.6)]'
          )}
        >
          <DialogTitle className="pr-10 text-xl leading-tight tracking-tight sm:text-2xl">{title}</DialogTitle>
          <DialogDescription className="max-w-[60ch] text-[0.8125rem] leading-snug text-pretty text-muted-foreground">
            {subtitle}
          </DialogDescription>
        </header>
        <div
          ref={trackScroll}
          data-ai-scroll=""
          className="ai-scroll-body min-h-0 flex-1 overflow-y-auto overscroll-contain py-5 pl-5 pr-2.5 sm:pl-6 sm:pr-4"
        >
          {children}
        </div>
        <div
          className={cn(
            BAR,
            'rounded-b-2xl border-t bg-surface px-5 py-4 sm:px-6',
            under.bottom && 'border-divider shadow-[0_-6px_12px_-10px_oklch(0_0_0/0.6)]'
          )}
        >
          {footer}
        </div>
      </DialogContent>
    </Dialog>
  );
};
