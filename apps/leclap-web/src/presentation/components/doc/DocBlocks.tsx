import { useId, useState } from 'react';
import { Check, Info, Lightbulb } from '@/presentation/components/icons';
import { CopyIcon } from '@/presentation/components/icons/copy';
import { cn } from '@/lib/utils';
import { SegmentedControl } from '@/presentation/components/ui';
import { commandSegments } from './command-wrap.logic';
import { parseKicker } from './kicker.logic';
import type { FieldRow } from './schemaFields';
import { useCopyFlash } from './use-copy-flash';

// ── Shared rhythm ───────────────────────────────────────────────────────────────
// Oswald is condensed: at the old 68ch a line carried ~90 characters, which the eye loses on the way
// back to the next line. 33rem holds it to about 70 at the 1rem body size, in prose and callouts alike.
const MEASURE = 'max-w-[33rem]';

// html's scroll-padding-top already clears the fixed site header. Below `xl` the sticky doc bar sits
// under it too, so an anchor target needs that much more; with the rail instead it only needs a breath
// of air. The scroll-spy reads the same computed margin, so a jump and the highlight agree on where a
// section starts.
const ANCHOR_OFFSET = 'scroll-mt-12 xl:scroll-mt-4';

// Brand-700 on the light canvas, brand-400 on ink: the lighter brand tones fail AA at eyebrow size on
// the light theme.
const EYEBROW = 'text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-400';

// Announces a completed copy to assistive tech: a button's own children are presentational, so the
// live region sits beside it, and it is always mounted — a region that appears with its message is
// not announced.
const CopyStatus = ({ copied }: { copied: boolean }) => (
  <span role="status" className="sr-only">
    {copied ? 'Copied to clipboard' : ''}
  </span>
);

// ── Copyable command pill ───────────────────────────────────────────────────────
// A dark terminal chip: a `$` prompt + the command, with the (visible) label underneath explaining
// what the command does. The whole pill copies the command on click and flashes a checkmark.
//
// It is a *block*: a row of these must stack, and a pill wide enough to overflow scrolls its own
// command rather than pushing the page sideways. It used to be `inline-flex`, which turned every
// `space-y-*` list of pills into an inline run that wrapped three-across.

// About as many mono characters as a 320px-wide pill holds on one line: a token up to this long never
// splits (see command-wrap.logic.ts), a longer one — a path — may.
const WHOLE_TOKEN_MAX = 24;

export const CommandPill = ({ command, label }: { command: string; label?: string }) => {
  const { copied, copy } = useCopyFlash();
  const labelId = useId();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          copy(command);
        }}
        aria-label={`Copy: ${command}`}
        aria-describedby={label ? labelId : undefined}
        // The Copy-page export skips buttons; these hand it the pill's content (see docMarkdown).
        data-md-command={command}
        data-md-label={label ?? ''}
        className="tap group flex w-full items-start gap-4 rounded-xl border border-white/10 bg-[oklch(0.2_0.01_280)] px-4 py-3 text-left shadow-lg shadow-black/20 transition-colors hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
      >
        {/* The pill is always dark, but the theme's gray scale is tuned for light surfaces — use fixed
            light tones so the command isn't dark-on-dark. */}
        <span className="min-w-0 flex-1">
          {/* A long command wraps onto a second line with a hanging indent (continuations line up past
              the `$` prompt) rather than scrolling sideways inside the pill — a scrollbar here hides
              half the flags behind a gesture nobody thinks to try, and the pill copies the whole
              command anyway. It wraps between tokens, never inside a flag; `anywhere` is the fallback
              for a token too long for the line, e.g. a path. */}
          <code className="block whitespace-pre-wrap pl-[1.4em] -indent-[1.4em] font-mono text-sm leading-6 text-[oklch(0.92_0.008_280)] [overflow-wrap:anywhere]">
            <span aria-hidden className="select-none text-[oklch(0.62_0.01_280)]">
              ${' '}
            </span>
            {commandSegments(command, WHOLE_TOKEN_MAX).map((segment, index) => (
              <span key={index} className={segment.whole ? 'whitespace-nowrap' : undefined}>
                {segment.text}
              </span>
            ))}
          </code>
          {label ? (
            <span id={labelId} className="mt-1.5 block text-[0.78rem] leading-5 text-[oklch(0.68_0.01_280)]">
              {label}
            </span>
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
      <CopyStatus copied={copied} />
    </>
  );
};

// A column of CommandPills. Explicit flex column so the stacking never depends on the pills' own
// display mode, and capped so a terminal line doesn't run the full content width.

export const CommandList = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('flex max-w-2xl flex-col gap-2', className)}>{children}</div>
);

// ── Eyebrow + anchored headings ─────────────────────────────────────────────────

// The small label above a heading. A backtick-wrapped kicker is a code identifier (see
// kicker.logic.ts) and keeps its case in mono; anything else is the tracked uppercase eyebrow.
export const Eyebrow = ({ kicker, className }: { kicker: string; className?: string }) => {
  const { text, code } = parseKicker(kicker);

  if (code) {
    return (
      <p className={cn('font-mono text-[0.8rem] font-medium text-brand-700 dark:text-brand-300', className)}>
        <code>{text}</code>
      </p>
    );
  }

  return <p className={cn(EYEBROW, className)}>{text}</p>;
};

// The heading text links to its own anchor, so any heading is one click from a shareable URL. The "#"
// only surfaces on hover or keyboard focus: the affordance is discoverable without every heading
// carrying a glyph at rest.
const AnchorLink = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <a href={`#${id}`} className="group/anchor rounded-sm">
    {children}
    <span
      aria-hidden="true"
      className="ml-2 font-sans text-brand-600 opacity-0 transition-opacity group-hover/anchor:opacity-100 group-focus-visible/anchor:opacity-100 dark:text-brand-300"
    >
      #
    </span>
  </a>
);

interface DocSectionProps {
  id: string;
  title: string;
  kicker?: string;
  children: React.ReactNode;
}

// `data-toc-level` is what the "On this page" list and the scroll-spy collect: a DocSection is a
// top-level entry, a RefTable or an example nests under it.
export const DocSection = ({ id, title, kicker, children }: DocSectionProps) => (
  <section id={id} data-toc-level="2" className={cn('mb-16', ANCHOR_OFFSET)}>
    <header className="mb-6">
      {kicker ? <Eyebrow kicker={kicker} className="mb-2" /> : null}
      {/* One clear step under the page title (the h1 is display-l): at the old 3xl the two read as the
          same size, and a page's outline came down to which heading had the eyebrow above it. */}
      <h2 className="text-balance font-display text-[1.375rem] font-bold leading-tight tracking-tight text-foreground sm:text-[1.625rem]">
        <AnchorLink id={id}>{title}</AnchorLink>
      </h2>
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

// Preflight also leaves links in the text colour with no underline — a link in a paragraph was
// indistinguishable from the words around it. Colour plus a quiet underline that firms up on hover,
// so a link reads as one without shouting in a reference page full of them.
const PROSE_LINKS =
  '[&_a]:font-medium [&_a]:text-brand-700 [&_a]:underline [&_a]:decoration-brand-500/40 [&_a]:underline-offset-[0.2em] [&_a:hover]:decoration-current dark:[&_a]:text-brand-300';

export const Prose = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn(MEASURE, 'space-y-4 text-base leading-7 text-gray-300', PROSE_LISTS, PROSE_LINKS, className)}>
    {children}
  </div>
);

// An identifier this short fits any line, so it never splits: broken at its hyphen, `ffmpeg-static`
// read as two tokens. Anything longer (a path, a flag run) may still wrap on a phone.
const UNBROKEN_CODE_MAX = 24;

// `leading-none` keeps the chip inside the paragraph's line box: inheriting the prose line height, the
// mono face sat on a different baseline and pushed every line holding a chip a few pixels taller than
// its neighbours. `box-decoration-clone` gives each half of a wrapped chip its own padding and border,
// and `anywhere` lets a path too long for a phone line break inside rather than widen the page.
// Light-theme text is brand-800: brand-700 on the chip's tint sat right at 4.5:1, too thin a margin
// for the densest text on the page.
export const Code = ({ children }: { children: React.ReactNode }) => (
  <code
    className={cn(
      'box-decoration-clone rounded-md border border-brand-500/20 bg-brand-500/10 px-1.5 py-0.5 font-mono text-[0.82em] font-medium leading-none text-brand-800 [overflow-wrap:anywhere] dark:border-brand-400/20 dark:bg-surface-2 dark:text-brand-200',
      typeof children === 'string' && children.length <= UNBROKEN_CODE_MAX && 'whitespace-nowrap'
    )}
  >
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
  <dl className="space-y-5">
    {rows.map((row) => (
      <div key={row.term}>
        <dt className="font-mono text-sm font-semibold text-foreground [overflow-wrap:anywhere]">{row.term}</dt>
        {row.meta ? (
          <dd className="mt-0.5 font-mono text-[0.78rem] text-secondary-700 [overflow-wrap:anywhere] dark:text-secondary-300">
            {row.meta}
          </dd>
        ) : null}
        <dd className={cn(MEASURE, 'text-sm leading-6 text-gray-400', PROSE_LINKS, row.meta ? 'mt-1' : 'mt-1.5')}>
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
          ariaLabel="Package manager"
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
//
// Below `sm` a three-column table leaves the description a 120px strip that wraps every few words
// while the Constraints column mostly holds a dash. There each row restacks: name and meaning across
// the full width, type and constraints on the line under it. The explicit roles keep it a table for
// assistive tech — WebKit drops table semantics once `display` stops being a table value.

export const FieldTable = ({ rows }: { rows: FieldRow[] }) => {
  if (rows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-2xl border border-divider bg-surface/60">
      <table role="table" className="w-full border-collapse text-left text-sm max-sm:block">
        <thead role="rowgroup" className="max-sm:sr-only">
          <tr
            role="row"
            className="border-b border-divider bg-foreground/[0.025] text-[0.7rem] uppercase tracking-wider text-gray-500"
          >
            <th role="columnheader" className="px-4 py-3 font-semibold">
              Field
            </th>
            <th role="columnheader" className="px-4 py-3 font-semibold">
              Type
            </th>
            <th role="columnheader" className="px-4 py-3 font-semibold">
              Constraints
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup" className="max-sm:block">
          {rows.map((row) => (
            <tr
              key={row.name}
              role="row"
              className="border-b border-divider/60 align-top transition-colors last:border-0 hover:bg-foreground/[0.025] max-sm:grid max-sm:grid-cols-[auto_minmax(0,1fr)] max-sm:gap-x-4 max-sm:gap-y-2 max-sm:px-4 max-sm:py-4"
            >
              <td
                role="cell"
                className="whitespace-nowrap px-4 py-3 max-sm:col-span-2 max-sm:whitespace-normal max-sm:p-0"
              >
                <span className="inline-flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[0.85rem] font-medium text-foreground">{row.name}</span>
                  {row.required ? (
                    <span className="rounded bg-brand-500/12 px-1.5 py-0.5 text-[0.58rem] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">
                      required
                    </span>
                  ) : null}
                </span>
                <p className="mt-1.5 whitespace-normal text-[0.85rem] leading-6 text-gray-400 sm:max-w-[42ch]">
                  {row.description}
                </p>
              </td>
              <td role="cell" className="px-4 py-3 max-sm:p-0">
                <span className="font-mono text-[0.78rem] text-secondary-700 dark:text-secondary-300">{row.type}</span>
              </td>
              <td role="cell" className="px-4 py-3 max-sm:p-0">
                {/* An unconstrained field shows a dash in the grid, but reads as an empty cell rather
                    than "dash"; stacked on a phone the dash would dangle beside the type, so it goes. */}
                <span className="font-mono text-[0.78rem] text-gray-400 [overflow-wrap:anywhere]">
                  {row.constraints || (
                    <span aria-hidden="true" className="max-sm:hidden">
                      —
                    </span>
                  )}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ── Anchored subsection ─────────────────────────────────────────────────────────
// The level under a DocSection: a reference table, an example. Its title is an h3 — the section's h2
// is the level above — with the same permalink, and it nests under that h2 in "On this page".
// `code` sets the title in mono, for a title that is a schema name rather than a phrase.

export const DocSubsection = ({
  id,
  title,
  code = false,
  children,
}: {
  id: string;
  title: string;
  code?: boolean;
  children: React.ReactNode;
}) => (
  <section id={id} data-toc-level="3" className={ANCHOR_OFFSET}>
    <h3
      className={cn(
        'mb-1.5 font-semibold text-foreground [overflow-wrap:anywhere]',
        code ? 'font-mono text-[1.0625rem]' : 'font-display text-lg tracking-tight'
      )}
    >
      <AnchorLink id={id}>{title}</AnchorLink>
    </h3>
    {children}
  </section>
);

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
  <DocSubsection id={id} title={title} code>
    {summary ? <p className={cn(MEASURE, 'mb-4 text-sm leading-6 text-gray-400')}>{summary}</p> : null}
    <FieldTable rows={rows} />
  </DocSubsection>
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

// "Copy-paste" descriptors used to mean selecting sixty lines by hand. The button sits over the
// block's top-right corner — every JSON sample opens on a lone `{`, so it covers no code at rest; its
// own fill keeps a long line scrolled under it from showing through — and it stays visible rather
// than hover-only, because a phone has no hover to reveal it.
const CopyCodeButton = ({ code }: { code: string }) => {
  const { copied, copy } = useCopyFlash();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          copy(code);
        }}
        aria-label="Copy JSON"
        title="Copy JSON"
        className={cn(
          'tap absolute right-2 top-2 z-10 grid h-10 w-10 place-items-center rounded-lg bg-[oklch(0.18_0.01_280_/_0.9)] transition-colors',
          copied ? 'text-success' : 'text-[oklch(0.68_0.01_280)] hover:bg-white/10 hover:text-[oklch(0.95_0.005_280)]'
        )}
      >
        {copied ? <Check className="h-4 w-4 pop-in" /> : <CopyIcon size={16} />}
      </button>
      <CopyStatus copied={copied} />
    </>
  );
};

// Past this many lines a block is a reference to search, not a sample to read. The full generated
// schema is ~17,600 lines: tokenised row by row it cost ~72k DOM nodes, a 1.5s freeze on a desktop,
// and a page half a million pixels tall. As one plain text node in a bounded scroller it opens at
// once, and find-in-page still searches it.
const LONG_BLOCK_LINES = 400;

export const JsonBlock = ({ code }: { code: string }) => {
  const lines = code.split('\n');

  if (lines.length > LONG_BLOCK_LINES) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-divider bg-[oklch(0.18_0.01_280)]">
        <CopyCodeButton code={code} />
        <pre className="max-h-[70vh] overflow-auto overscroll-contain p-4 text-[0.8rem] leading-6">
          <code className="font-mono text-[oklch(0.78_0.012_280)]">{code}</code>
        </pre>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-divider bg-[oklch(0.18_0.01_280)]">
      <CopyCodeButton code={code} />
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

// ── Pull-out notes ──────────────────────────────────────────────────────────────
// Two tints for two jobs: the brand Callout carries a constraint or a fact worth stopping for, the
// accent Tip a piece of advice. Same shape for both — a hairline frame on a faint wash, the label set
// like an eyebrow with its icon — so they differ in meaning, not in construction. (A coloured stripe
// down one rounded edge bent into a crescent at the corners.)

const NOTE_BODY = cn(MEASURE, 'mt-2 text-[0.95rem] leading-7 text-gray-300', PROSE_LISTS, PROSE_LINKS);

export const Callout = ({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <aside
    className={cn(
      'rounded-xl border border-brand-500/25 bg-brand-500/[0.06] px-5 py-4 dark:border-brand-400/20 dark:bg-brand-400/[0.07]',
      className
    )}
  >
    <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
      <Info aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> {label}
    </p>
    <div className={NOTE_BODY}>{children}</div>
  </aside>
);

export const Tip = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <aside
    className={cn(
      'rounded-xl border border-accent-600/30 bg-accent-400/[0.12] px-5 py-4 dark:border-accent-400/20 dark:bg-accent-400/[0.06]',
      className
    )}
  >
    {/* On the light theme even accent-700 falls under 4:1 on the yellow wash at eyebrow size, so the
        word takes the ink colour and the bulb carries the amber (a glyph needs 3:1, which it clears). */}
    <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-foreground dark:text-accent-400">
      <Lightbulb aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-accent-700 dark:text-accent-400" /> Tip
    </p>
    <div className={NOTE_BODY}>{children}</div>
  </aside>
);
