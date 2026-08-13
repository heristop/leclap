import { AlertCircle } from '@/presentation/components/icons';

interface RejectionSlateProps {
  title: string;
  messages: string[];
}

// Rejections read as a slate struck against the take: a danger hairline down the edge, then the list.
// role="alert" because the previous implementation surfaced failures visually only — assistive tech
// heard nothing at all.
export function RejectionSlate({ title, messages }: RejectionSlateProps) {
  if (messages.length === 0) return null;

  return (
    <div role="alert" className="relative overflow-hidden rounded-xl bg-[var(--color-error)]/8 p-3 pl-4 text-sm">
      <span aria-hidden="true" className="danger-gradient absolute inset-y-0 left-0 w-1" />
      <p className="flex items-center gap-2 font-medium text-[var(--color-error)]">
        <AlertCircle className="size-4 shrink-0" />
        {title}
      </p>
      {/* Keyed by position: the list is render-only and never reordered, and two rejections can
          translate to the same sentence (every surplus file yields one identical too-many-files
          line), so the message itself is not a unique key. */}
      <ul className="mt-1 space-y-0.5 text-muted-foreground">
        {messages.map((message, index) => (
          <li key={index}>{message}</li>
        ))}
      </ul>
    </div>
  );
}
