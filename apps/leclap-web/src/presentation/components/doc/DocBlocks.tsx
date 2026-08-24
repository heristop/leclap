import { useState } from 'react';
import { Check, Lightbulb } from '@/presentation/components/icons';
import { CopyIcon } from '@/presentation/components/icons/copy';
import { cn } from '@/lib/utils';
import { Badge, SegmentedControl } from '@/presentation/components/ui';
import { logger } from '@/lib/logger';
import type { FieldRow } from './schemaFields';

// ── Copyable command pill ───────────────────────────────────────────────────────
// A dark terminal chip: a `$` prompt + the command, with the (visible) label underneath explaining
// what the command does. The whole pill copies the command on click and flashes a checkmark.
//
// It is a *block*: a row of these must stack, and a pill wide enough to overflow scrolls its own
// command rather than pushing the page sideways. It used to be `inline-flex`, which turned every
// `space-y-*` list of pills into an inline run that wrapped three-across.

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
      className="tap group flex w-full items-start gap-4 rounded-xl border border-white/10 bg-[oklch(0.2_0.01_280)] px-4 py-3 text-left shadow-lg shadow-black/20 transition-colors hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
    >
      {/* The pill is always dark, but the theme's gray scale is tuned for light surfaces — use fixed
          light tones so the command isn't dark-on-dark. */}
      <span className="min-w-0 flex-1">
        {/* A long command wraps onto a second line with a hanging indent (continuations line up past
            the `$` prompt) rather than scrolling sideways inside the pill — a scrollbar here hides
            half the flags behind a gesture nobody thinks to try, and the pill copies the whole
            command anyway. `anywhere` is the fallback for a single unbreakable token, e.g. a path. */}
        <code className="block whitespace-pre-wrap pl-[1.4em] -indent-[1.4em] font-mono text-sm leading-6 text-[oklch(0.92_0.008_280)] [overflow-wrap:anywhere]">
          <span aria-hidden className="select-none text-[oklch(0.62_0.01_280)]">
            ${' '}
          </span>
          {command}
        </code>
        {label ? (
          <span className="mt-1.5 block text-[0.78rem] leading-5 text-[oklch(0.68_0.01_280)]">{label}</span>
        ) : null}
      </span>
      <span
        className={cn(
          'grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors',
          copied
            ? 'text-success'
            : 'text-[oklch(0.68_0.01_280)] group-hover:bg-white/10 group-hover:text-[oklch(0.95_0.005_280)]'
        )}
      >
        {copied ? <Check className="h-4 w-4 pop-in" /> : <CopyIcon size={16} />}
      </span>
    </button>
  );
};

// A column of CommandPills. Explicit flex column so the stacking never depends on the pills' own
// display mode, and capped so a terminal line doesn't run the full content width.

export const CommandList = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('flex max-w-2xl flex-col gap-2', className)}>{children}</div>
);

// ── Anchored section heading ────────────────────────────────────────────────────
// Owns an anchor id with scroll-mt for the sticky header; shows a "#" permalink on hover.

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
    {/* One vertical rhythm for every block a section holds — prose, command lists, JSON, callouts —
        so a Tip never butts against the code block above it and no call site has to hand-tune a
        margin between two siblings. */}
    <div className="space-y-5">{children}</div>
  </section>
);

// ── Prose ───────────────────────────────────────────────────────────────────────

// Preflight resets `list-style` and the list padding to nothing, so a bare <ul> in a doc page renders
// as unmarked, unindented paragraphs — indistinguishable from body copy. Restore markers here rather
// than at each call site.
const PROSE_LISTS =
  '[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:pl-1 [&_li]:marker:text-brand-500/70 [&_li+li]:mt-2';

export const Prose = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('max-w-[68ch] text-[0.95rem] leading-7 text-gray-300 space-y-4', PROSE_LISTS, className)}>
    {children}
  </div>
);

export const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded-md border border-brand-500/20 bg-brand-500/10 px-1.5 py-0.5 font-mono text-[0.82em] font-medium text-brand-700 dark:border-brand-400/20 dark:bg-surface-2 dark:text-brand-200">
    {children}
  </code>
);

// ── Definition list ─────────────────────────────────────────────────────────────
// The workhorse for "one monospace name, one plain-English description" reference blocks: MCP tools,
// env vars, CLI flags. `meta` carries a secondary monospace line (a tool's arguments, a flag's
// default) so the shape stays name · meta · meaning everywhere.

export interface DefRow {
  term: string;
  meta?: string;
  children: React.ReactNode;
}

export const DefList = ({ rows }: { rows: readonly DefRow[] }) => (
  <dl className="space-y-4">
    {rows.map((row) => (
      <div key={row.term}>
        <dt className="font-mono text-sm font-semibold text-foreground">{row.term}</dt>
        {row.meta ? (
          <dd className="mt-0.5 font-mono text-[0.78rem] text-secondary-700 dark:text-secondary-300">{row.meta}</dd>
        ) : null}
        <dd className={cn('max-w-[68ch] text-sm leading-6 text-gray-400', row.meta ? 'mt-1' : 'mt-1.5')}>
          {row.children}
        </dd>
      </div>
    ))}
  </dl>
);

// ── CLI quick-start with a package-manager switch ────────────────────────────────
// The same three steps rendered for the reader's package manager. Each PM differs in its one-off
// runner (npx / pnpm dlx / yarn dlx / bunx), its install verb, and how it runs a package script.

const PACKAGE_MANAGERS = ['npm', 'pnpm', 'yarn', 'bun'] as const;
type PackageManager = (typeof PACKAGE_MANAGERS)[number];

const PM_DLX: Record<PackageManager, string> = { npm: 'npx', pnpm: 'pnpm dlx', yarn: 'yarn dlx', bun: 'bunx' };
const PM_INSTALL: Record<PackageManager, string> = {
  npm: 'npm install',
  pnpm: 'pnpm install',
  yarn: 'yarn',
  bun: 'bun install',
};
const PM_RUN: Record<PackageManager, string> = {
  npm: 'npm run render',
  pnpm: 'pnpm render',
  yarn: 'yarn render',
  bun: 'bun run render',
};

export const CliGetStarted = () => {
  const [pm, setPm] = useState<PackageManager>('pnpm');

  return (
    <div className="mt-7 flex max-w-xl flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Get started with the CLI</p>
        <SegmentedControl
          value={pm}
          onChange={(value) => {
            setPm(value as PackageManager);
          }}
          options={PACKAGE_MANAGERS.map((name) => ({ value: name, label: name }))}
          classNames={{
            track: 'bg-[oklch(0.2_0.01_280)]',
            thumb: 'bg-brand-500/20 shadow-none ring-1 ring-brand-500/60',
            button: 'px-2.5 py-1 font-mono text-xs',
            active: 'text-[oklch(0.92_0.008_280)]',
            inactive: 'text-[oklch(0.62_0.01_280)] hover:text-[oklch(0.85_0.008_280)]',
          }}
        />
      </div>
      <CommandPill command={`${PM_DLX[pm]} @leclap/cli init my-video`} />
      <CommandPill command={`cd my-video && ${PM_INSTALL[pm]}`} />
      <CommandPill command={PM_RUN[pm]} />
      <p className="text-sm leading-6 text-gray-400">
        <Code>init</Code> also offers to wire the <Code>@leclap/mcp</Code> server and a Remotion intro. Then{' '}
        <Code>leclap diagnose</Code> to check your FFmpeg, or <Code>leclap --help</Code> for every command.
      </p>
    </div>
  );
};

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

// ── Named reference table ───────────────────────────────────────────────────────
// A schema-driven field table with its own anchored heading + summary. The workhorse of the
// reference pages — pass the rows from `docGroups.*` and it renders title · blurb · table.

export const RefTable = ({
  id,
  title,
  summary,
  rows,
}: {
  id: string;
  title: string;
  summary?: string;
  rows: FieldRow[];
}) => (
  <section id={id} className="scroll-mt-28">
    <h2 className="mb-1 font-mono text-lg font-semibold text-foreground">{title}</h2>
    {summary ? <p className="mb-3 max-w-[68ch] text-sm leading-6 text-gray-400">{summary}</p> : null}
    <FieldTable rows={rows} />
  </section>
);

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

// ── Config sample ───────────────────────────────────────────────────────────────
// A labelled JSON snippet illustrating one feature in context.

export const Sample = ({
  code,
  title = 'Config sample',
  className,
}: {
  code: string;
  title?: string;
  className?: string;
}) => (
  <div className={cn('mt-6', className)}>
    <h3 className="mb-2 text-sm font-semibold text-foreground">{title}</h3>
    <JsonBlock code={code} />
  </div>
);

// ── Pull-out note ───────────────────────────────────────────────────────────────

export const Callout = ({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <aside className={cn('rounded-2xl border-l-2 border-brand-500/60 bg-brand-500/5 px-5 py-4', className)}>
    <Badge variant="brand">{label}</Badge>
    <div className={cn('mt-2 max-w-[64ch] text-[0.9rem] leading-7 text-gray-300', PROSE_LISTS)}>{children}</div>
  </aside>
);

// ── Tip ───────────────────────────────────────────────────────────────────────────
// Amber aside for "do this" advice — visually distinct from the brand Callout.

export const Tip = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <aside
    className={cn(
      'rounded-2xl border-l-2 border-accent-600/50 bg-accent-400/[0.08] px-5 py-4 dark:border-accent-400/60',
      className
    )}
  >
    <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-accent-700 dark:text-accent-400">
      <Lightbulb aria-hidden="true" className="h-3.5 w-3.5" /> Tip
    </p>
    <div className={cn('mt-2 max-w-[64ch] text-[0.9rem] leading-7 text-gray-300', PROSE_LISTS)}>{children}</div>
  </aside>
);
