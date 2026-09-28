import { AlertTriangle, ArrowRight, ArrowUpRight, Check, X } from '@/presentation/components/icons';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Seo } from '@/presentation/components/Seo';
import { KineticHeading } from '@/presentation/components/kinetic';
import { Button, Reveal } from '@/presentation/components/ui';
import { cn } from '@/lib/utils';

// The comparison rows are the ones in the repo README's "Why LeClap?" table, kept deliberately
// identical: two surfaces claiming different things about the same competitor is worse than not
// publishing either. Every Remotion claim was checked against Remotion's own docs (linked at the
// bottom of the page) — most importantly that Remotion *does* render client-side with no server
// since 4.0.491, so the difference is the browser engine it still needs, not a server.

type Verdict = 'yes' | 'no' | 'partial';

/** One row of the table: a criterion plus what each product does about it. */
type Row = {
  id: string;
  leclap: Verdict | 'none';
  remotion: Verdict | 'none';
};

const ROWS: readonly Row[] = [
  { id: 'native', leclap: 'yes', remotion: 'no' },
  { id: 'server', leclap: 'yes', remotion: 'yes' },
  { id: 'deterministic', leclap: 'yes', remotion: 'yes' },
  { id: 'agent', leclap: 'yes', remotion: 'partial' },
  { id: 'model', leclap: 'none', remotion: 'none' },
];

const VERDICT_ICON = { yes: Check, no: X, partial: AlertTriangle } as const;

const VERDICT_TONE = {
  yes: 'text-success-foreground',
  no: 'text-error',
  partial: 'text-warning',
} as const;

// The encoder each target takes, in the order the caveat reads them.
const ENCODER_TARGETS = ['web', 'android', 'ios'] as const;

const REMOTION_WINS = ['composition', 'scale', 'ecosystem', 'web'] as const;
const LECLAP_WINS = ['native', 'privacy', 'agent', 'data'] as const;

const SOURCES = [
  { id: 'clientSide', href: 'https://www.remotion.dev/docs/client-side-rendering' },
  { id: 'limitations', href: 'https://www.remotion.dev/docs/client-side-rendering/limitations' },
  { id: 'randomness', href: 'https://www.remotion.dev/docs/flickering' },
  { id: 'systemPrompt', href: 'https://www.remotion.dev/docs/ai/system-prompt' },
  { id: 'player', href: 'https://www.remotion.dev/docs/player' },
  { id: 'lambda', href: 'https://www.remotion.dev/docs/lambda' },
  { id: 'readme', href: 'https://github.com/heristop/leclap#-why-leclap' },
] as const;

// One title style for every section, so the page reads as one argument rather than a stack of widgets.
const SECTION_TITLE = 'font-display text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl';

// The product labels over columns and caveats: LeClap in the brand hue (it is LeClap's page, and says so),
// Remotion neutral. Both clear 4.5:1 at this size on either theme.
const LABEL = 'text-xs font-semibold uppercase tracking-wider';
const LABEL_LECLAP = cn(LABEL, 'text-brand-700 dark:text-brand-300');
const LABEL_REMOTION = cn(LABEL, 'text-gray-500');

// LeClap's column keeps a faint brand wash in the table and the stacked cards alike.
const LECLAP_WASH = 'bg-brand-500/[0.06]';

/**
 * A verdict as a word, not just a glyph: "Yes / No / Partly" is what the eye scans down a column, and a word
 * keeps full text contrast where the tinted icons alone would not. The note qualifies it underneath.
 */
const VerdictCell = ({ verdict, label, note }: { verdict: Verdict | 'none'; label: string; note: string }) => {
  if (verdict === 'none') {
    return <p className="text-sm leading-relaxed text-foreground">{note}</p>;
  }

  const Icon = VERDICT_ICON[verdict];

  return (
    <div>
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon aria-hidden="true" className={cn('size-4 shrink-0', VERDICT_TONE[verdict])} />
        {label}
      </p>
      <p className="mt-1 pl-6 text-sm leading-relaxed text-gray-400">{note}</p>
    </div>
  );
};

/** One "choose X when…" column: a title, its lead, and the reasons as a ruled list. */
const ChooseList = ({
  scope,
  ids,
  accent = false,
}: {
  scope: 'chooseRemotion' | 'chooseLeClap';
  ids: readonly string[];
  accent?: boolean;
}) => {
  const { t } = useTranslation('compare');
  const titleId = `compare-${scope}`;

  return (
    // A subgrid row pair from `lg`, so both lists start on the same line however the two leads wrap.
    <section aria-labelledby={titleId} className="lg:row-span-2 lg:grid lg:grid-rows-subgrid">
      <Reveal>
        <h2 id={titleId} className={SECTION_TITLE}>
          {t(`remotion.${scope}.title`)}
        </h2>
        <p className="mt-2 text-pretty text-gray-400">{t(`remotion.${scope}.lead`)}</p>
      </Reveal>
      {/* The rule above the list carries the same colour as the column labels: brand for LeClap. */}
      <ul role="list" className={cn('mt-6 border-t', accent ? 'border-brand-500/50' : 'border-divider')}>
        {ids.map((id, index) => (
          <li key={id} className="border-b border-divider">
            <Reveal delay={index * 80} className="py-5">
              <h3 className="text-lg font-semibold leading-snug text-foreground">
                {t(`remotion.${scope}.${id}.title`)}
              </h3>
              <p className="mt-1.5 leading-relaxed text-pretty text-gray-400">{t(`remotion.${scope}.${id}.body`)}</p>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
};

export const CompareRemotion = () => {
  const { t } = useTranslation('compare');
  const verdictLabel = {
    yes: t('remotion.table.yes'),
    no: t('remotion.table.no'),
    partial: t('remotion.table.partial'),
  };
  const labelFor = (verdict: Verdict | 'none'): string => (verdict === 'none' ? '' : verdictLabel[verdict]);

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden pt-24 pb-20">
      <Seo
        title={t('compareRemotion.title', { ns: 'seo' })}
        description={t('compareRemotion.description', { ns: 'seo' })}
        path="/compare/remotion"
      />
      {/* Same ambient aurora as /about, so the comparison reads as part of the site rather than a
          bolted-on landing page. Frozen under the global reduced-motion reset. */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="animate-aurora absolute top-0 left-1/4 h-96 w-96 rounded-full bg-brand-500/10 blur-[120px]" />
        <div className="animate-aurora absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-secondary-500/10 blur-[120px] [animation-delay:-9s]" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* The hero states the premise and the promise; the mechanics wait under the table they explain. */}
        <header className="mx-auto mb-14 max-w-3xl text-center fade-in">
          {/* The landing's eyebrow: plain lavender type, which holds its contrast where a tinted chip did not. */}
          <p className="-mr-[0.3em] text-xs font-semibold uppercase tracking-[0.3em] text-brand-700 dark:text-brand-300">
            {t('remotion.badge')}
          </p>
          <div className="mt-5 mb-6 overflow-x-clip">
            <KineticHeading text={t('remotion.title')} as="h1" level="hero" align="center" />
          </div>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-balance text-gray-400 sm:text-xl">
            {t('remotion.tagline')}
          </p>
        </header>

        <div className="mx-auto max-w-5xl">
          <section aria-labelledby="compare-table">
            <Reveal>
              <h2 id="compare-table" className={SECTION_TITLE}>
                {t('remotion.table.heading')}
              </h2>
              <p className="mt-3 max-w-3xl leading-relaxed text-pretty text-gray-400">{t('remotion.table.lead')}</p>

              {/* From tablet width up, a real table: three columns fit, and nothing scrolls sideways. */}
              <div className="mt-6 hidden overflow-hidden rounded-2xl border border-divider bg-surface/60 md:block">
                <table className="w-full table-fixed border-collapse text-left">
                  <colgroup>
                    <col className="w-[30%]" />
                    <col className="w-[35%]" />
                    <col className="w-[35%]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-divider">
                      <th scope="col" className={cn(LABEL, 'px-5 py-3.5 text-gray-500')}>
                        {t('remotion.table.criterion')}
                      </th>
                      <th scope="col" className={cn(LABEL_LECLAP, LECLAP_WASH, 'px-5 py-3.5')}>
                        {t('remotion.table.leclap')}
                      </th>
                      <th scope="col" className={cn(LABEL_REMOTION, 'px-5 py-3.5')}>
                        {t('remotion.table.remotion')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ROWS.map((row) => (
                      <tr key={row.id} className="border-b border-divider/60 align-top last:border-0">
                        <th scope="row" className="px-5 py-4 text-sm leading-snug font-medium text-foreground">
                          {t(`remotion.table.${row.id}.label`)}
                        </th>
                        <td className={cn(LECLAP_WASH, 'px-5 py-4')}>
                          <VerdictCell
                            verdict={row.leclap}
                            label={labelFor(row.leclap)}
                            note={t(`remotion.table.${row.id}.leclap`)}
                          />
                        </td>
                        <td className="px-5 py-4">
                          <VerdictCell
                            verdict={row.remotion}
                            label={labelFor(row.remotion)}
                            note={t(`remotion.table.${row.id}.remotion`)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* On a phone the same rows stack: each criterion, then both answers in full. A three-column
                  table at 390px either scrolls sideways — hiding the Remotion column behind the fold — or
                  squeezes every note to three words a line. */}
              <ul
                role="list"
                className="mt-6 divide-y divide-divider overflow-hidden rounded-2xl border border-divider bg-surface/60 md:hidden"
              >
                {ROWS.map((row) => (
                  <li key={row.id} className="p-4">
                    <h3 className="text-base leading-snug font-semibold text-foreground">
                      {t(`remotion.table.${row.id}.label`)}
                    </h3>
                    <dl className="mt-3 grid gap-1">
                      <div className={cn(LECLAP_WASH, 'rounded-xl px-3.5 py-3')}>
                        <dt className={LABEL_LECLAP}>{t('remotion.table.leclap')}</dt>
                        <dd className="mt-1.5">
                          <VerdictCell
                            verdict={row.leclap}
                            label={labelFor(row.leclap)}
                            note={t(`remotion.table.${row.id}.leclap`)}
                          />
                        </dd>
                      </div>
                      <div className="px-3.5 py-3">
                        <dt className={LABEL_REMOTION}>{t('remotion.table.remotion')}</dt>
                        <dd className="mt-1.5">
                          <VerdictCell
                            verdict={row.remotion}
                            label={labelFor(row.remotion)}
                            note={t(`remotion.table.${row.id}.remotion`)}
                          />
                        </dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            </Reveal>
          </section>

          {/* The caveats are the page's proof of good faith, so they get a section of their own and their
              technical detail laid out to be checked: each target beside the encoder it actually uses. */}
          <section aria-labelledby="compare-caveats" className="mt-16">
            <Reveal>
              <h2 id="compare-caveats" className={SECTION_TITLE}>
                {t('remotion.caveats.title')}
              </h2>
              <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:items-start">
                <div className="rounded-2xl border border-divider bg-surface/60 p-5 sm:p-6">
                  <h3 className={LABEL_LECLAP}>{t('remotion.table.leclap')}</h3>
                  <p className="mt-2 leading-relaxed font-medium text-pretty text-foreground">
                    {t('remotion.caveats.leclap.lead')}
                  </p>
                  <dl className="mt-4 divide-y divide-divider/70 border-y border-divider/70">
                    {ENCODER_TARGETS.map((id) => (
                      <div key={id} className="grid gap-1 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
                        <dt className="text-sm font-medium text-foreground">
                          {t(`remotion.caveats.leclap.${id}.target`)}
                        </dt>
                        <dd className="text-sm leading-relaxed text-gray-400">
                          {t(`remotion.caveats.leclap.${id}.encoder`)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-4 text-sm leading-relaxed text-pretty text-gray-400">
                    {t('remotion.caveats.leclap.filters')}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed font-medium text-pretty text-foreground">
                    {t('remotion.caveats.leclap.close')}
                  </p>
                </div>
                <div className="rounded-2xl border border-divider p-5 sm:p-6">
                  <h3 className={LABEL_REMOTION}>{t('remotion.table.remotion')}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-pretty text-gray-400">
                    {t('remotion.caveats.remotion')}
                  </p>
                </div>
              </div>
            </Reveal>
          </section>

          {/* Remotion's case first and at equal weight, side by side from `lg`: four reasons each. */}
          <div className="mt-20 grid gap-14 lg:grid-cols-2 lg:gap-x-12 lg:gap-y-0">
            <ChooseList scope="chooseRemotion" ids={REMOTION_WINS} />
            <ChooseList scope="chooseLeClap" ids={LECLAP_WINS} accent />
          </div>

          <Reveal className="mt-20 border-t border-divider pt-10">
            <h2 className="text-lg font-semibold text-foreground">{t('remotion.sources.title')}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-pretty text-gray-400">
              {t('remotion.sources.lead')}
            </p>
            <ul className="mt-4 grid gap-x-8 sm:grid-cols-2">
              {SOURCES.map((source) => (
                <li key={source.id}>
                  <a
                    href={source.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    // `min-h-10` turns a 20px line of text into a row a thumb can hit without its neighbour.
                    className="group inline-flex min-h-10 items-center gap-1.5 rounded-sm text-sm text-brand-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-300"
                  >
                    {t(`remotion.sources.${source.id}`)}
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:-translate-y-0.5" />
                  </a>
                </li>
              ))}
            </ul>
          </Reveal>

          {/* The prompt asks what a template looks like, so the primary answer shows one; the studio is the
              next step for anyone already convinced. */}
          <Reveal delay={120} className="mt-20 text-center">
            <p className="mb-6 text-gray-400">{t('remotion.cta.prompt')}</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="group rounded-full lift">
                <Link to="/doc/examples">
                  {t('remotion.cta.example')}
                  <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary" className="rounded-full">
                <Link to="/studio">{t('remotion.cta.start')}</Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
};
