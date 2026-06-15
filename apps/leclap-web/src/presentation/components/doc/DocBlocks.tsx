import { cn } from '@/lib/utils';
import { Badge } from '@/presentation/components/ui';
import type { FieldRow } from './schemaFields';

// ── Anchored section heading ────────────────────────────────────────────────────
// A section wrapper that owns its anchor id, offsets for the fixed header, and a
// hover-revealed "#" permalink so any subsection is linkable and keyboard-reachable.

interface DocSectionProps {
  id: string;
  title: string;
  kicker?: string;
  children: React.ReactNode;
}

export const DocSection = ({ id, title, kicker, children }: DocSectionProps) => (
  <section id={id} className="scroll-mt-28 mb-16">
    <header className="mb-5">
      {kicker ? (
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-brand-500/90 mb-1.5">{kicker}</p>
      ) : null}
      <a href={`#${id}`} className="group inline-flex items-baseline gap-2 no-underline">
        <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-foreground">{title}</h2>
        <span
          aria-hidden="true"
          className="text-brand-400 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity"
        >
          #
        </span>
      </a>
    </header>
    {children}
  </section>
);

// ── Prose ───────────────────────────────────────────────────────────────────────
// Caps measure at a comfortable reading width and tints body text off the surface.

export const Prose = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('max-w-[68ch] text-[0.95rem] leading-7 text-gray-300 space-y-4', className)}>{children}</div>
);

export const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded-md border border-brand-500/20 bg-brand-500/10 px-1.5 py-0.5 font-mono text-[0.82em] font-medium text-brand-700 dark:border-brand-400/20 dark:bg-surface-2 dark:text-brand-200">
    {children}
  </code>
);

// ── Field table ─────────────────────────────────────────────────────────────────
// Schema-driven: each row is one object property (name · type · constraints · meaning).

export const FieldTable = ({ rows }: { rows: FieldRow[] }) => {
  if (rows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-2xl border border-divider bg-surface/60">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-divider text-[0.7rem] uppercase tracking-wider text-gray-500">
            <th className="px-4 py-3 font-semibold">Field</th>
            <th className="px-4 py-3 font-semibold">Type</th>
            <th className="px-4 py-3 font-semibold">Constraints</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-b border-divider/60 align-top last:border-0">
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="font-mono text-[0.85rem] text-foreground">{row.name}</span>
                {row.required ? <span className="ml-1.5 align-top text-[0.6rem] text-accent-400">req</span> : null}
                <p className="mt-1 max-w-[42ch] text-[0.8rem] leading-5 text-gray-400 whitespace-normal">
                  {row.description}
                </p>
              </td>
              <td className="px-4 py-3">
                <span className="font-mono text-[0.78rem] text-secondary-400">{row.type}</span>
              </td>
              <td className="px-4 py-3">
                <span className="font-mono text-[0.78rem] text-gray-400">{row.constraints || '—'}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ── Reference chip list ─────────────────────────────────────────────────────────
// Renders a live enum (transitions / looks / curves) as monospace chips.

export const ChipList = ({ items }: { items: readonly string[] }) => (
  <ul className="flex flex-wrap gap-1.5">
    {items.map((item) => (
      <li key={item}>
        <span className="inline-block rounded-lg border border-divider bg-surface-2 px-2 py-1 font-mono text-[0.78rem] text-gray-300">
          {item}
        </span>
      </li>
    ))}
  </ul>
);

// ── JSON code block ─────────────────────────────────────────────────────────────
// A monospace block with line numbers and a light key/string/number tint. We tokenise
// per line with a single regex pass — enough to read structure, not a full lexer.

const TOKEN = /("(?:[^"\\]|\\.)*"\s*:)|("(?:[^"\\]|\\.)*")|(\b-?\d+(?:\.\d+)?\b)|(\btrue\b|\bfalse\b|\bnull\b)/g;

// Capture-group index → tint class. groups[1..4] map to key / string / number / literal;
// the first defined group in a match wins.
const TINTS = ['text-brand-300', 'text-secondary-400', 'text-accent-400', 'text-gray-500'];

const tintFor = (match: RegExpMatchArray): string => {
  // A matched capture group is a non-empty substring; the unmatched ones are
  // undefined at runtime (truthiness distinguishes them without a redundant check).
  for (let group = 1; group <= TINTS.length; group += 1) {
    if (match[group]) return TINTS[group - 1];
  }

  return '';
};

const tintLine = (line: string): React.ReactNode[] => {
  const out: React.ReactNode[] = [];
  let last = 0;
  let key = 0;

  for (const match of line.matchAll(TOKEN)) {
    const text = match[0];
    const at = match.index;

    if (at > last) out.push(line.slice(last, at));

    out.push(
      <span key={key++} className={tintFor(match)}>
        {text}
      </span>
    );
    last = at + text.length;
  }

  if (last < line.length) out.push(line.slice(last));

  return out;
};

export const JsonBlock = ({ code }: { code: string }) => {
  const lines = code.split('\n');

  return (
    <div className="overflow-hidden rounded-2xl border border-divider bg-[oklch(0.18_0.01_280)]">
      <pre className="overflow-x-auto p-4 text-[0.8rem] leading-6">
        <code className="font-mono">
          {lines.map((line, index) => (
            <div key={index} className="grid grid-cols-[2.5rem_1fr] gap-3">
              <span aria-hidden="true" className="select-none text-right text-gray-600">
                {index + 1}
              </span>
              <span className="text-gray-200">{tintLine(line)}</span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
};

// ── Pull-out note ───────────────────────────────────────────────────────────────

export const Callout = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <aside className="rounded-2xl border-l-2 border-brand-500/60 bg-brand-500/5 px-5 py-4">
    <Badge variant="brand">{label}</Badge>
    <div className="mt-2 max-w-[64ch] text-[0.9rem] leading-7 text-gray-300">{children}</div>
  </aside>
);
