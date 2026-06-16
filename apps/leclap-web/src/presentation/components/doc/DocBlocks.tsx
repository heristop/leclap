import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/presentation/components/ui';
import { logger } from '@/lib/logger';
import type { FieldRow } from './schemaFields';

// ── Copyable command pill ───────────────────────────────────────────────────────
// A dark terminal chip: a `$` prompt + the command; the whole pill copies on click and flashes a
// checkmark.

export const CommandPill = ({ command, label }: { command: string; label?: string }) => {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard
      .writeText(command)
      .then(() => {
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
        }, 1500);
      })
      .catch((error: unknown) => {
        logger.error('Copy failed', error);
      });
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? 'Copied' : `Copy: ${command}`}
      className="tap group inline-flex max-w-full items-center gap-4 rounded-xl border border-white/10 bg-[oklch(0.2_0.01_280)] px-4 py-3 text-left shadow-lg shadow-black/20 transition-colors hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
    >
      <code className="overflow-x-auto whitespace-nowrap font-mono text-sm text-gray-100">
        <span aria-hidden className="select-none text-gray-500">
          ${' '}
        </span>
        {command}
      </code>
      <span
        className={cn(
          'ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors',
          copied ? 'text-success' : 'text-gray-400 group-hover:bg-white/10 group-hover:text-gray-100'
        )}
      >
        {copied ? <Check className="h-4 w-4 pop-in" /> : <Copy className="h-4 w-4" />}
        {label && <span className="sr-only">{label}</span>}
      </span>
    </button>
  );
};

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
          className="text-brand-600 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 dark:text-brand-300"
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
          <tr className="border-b border-divider bg-foreground/[0.025] text-[0.7rem] uppercase tracking-wider text-gray-500">
            <th className="px-4 py-3 font-semibold">Field</th>
            <th className="px-4 py-3 font-semibold">Type</th>
            <th className="px-4 py-3 font-semibold">Constraints</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.name}
              className="border-b border-divider/60 align-top transition-colors last:border-0 hover:bg-foreground/[0.025]"
            >
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="inline-flex items-center gap-2">
                  <span className="font-mono text-[0.85rem] font-medium text-foreground">{row.name}</span>
                  {row.required ? (
                    <span className="rounded bg-brand-500/12 px-1.5 py-0.5 text-[0.58rem] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">
                      required
                    </span>
                  ) : null}
                </span>
                <p className="mt-1.5 max-w-[42ch] text-[0.8rem] leading-5 text-gray-400 whitespace-normal">
                  {row.description}
                </p>
              </td>
              <td className="px-4 py-3">
                <span className="font-mono text-[0.78rem] text-secondary-700 dark:text-secondary-300">{row.type}</span>
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
              <span aria-hidden="true" className="select-none text-right text-[oklch(0.5_0.012_280)]">
                {index + 1}
              </span>
              {/* The block is always dark, but the theme's gray scale is tuned for light surfaces,
                  so use a fixed light tone — otherwise braces/brackets/commas render dark-on-dark. */}
              <span className="text-[oklch(0.78_0.012_280)]">{tintLine(line)}</span>
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
