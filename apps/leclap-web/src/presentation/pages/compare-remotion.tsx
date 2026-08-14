import { AlertTriangle, ArrowRight, ArrowUpRight, Check, X } from '@/presentation/components/icons';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Seo } from '@/presentation/components/Seo';
import { KineticHeading } from '@/presentation/components/kinetic';
import { Badge, Button, Reveal } from '@/presentation/components/ui';
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

const REMOTION_WINS = ['composition', 'scale', 'ecosystem', 'web'] as const;
const LECLAP_WINS = ['native', 'privacy', 'agent', 'data'] as const;

const SOURCES = [
  { id: 'clientSide', href: 'https://www.remotion.dev/docs/client-side-rendering' },
  { id: 'limitations', href: 'https://www.remotion.dev/docs/client-side-rendering/limitations' },
  { id: 'randomness', href: 'https://www.remotion.dev/docs/flickering' },
  { id: 'systemPrompt', href: 'https://www.remotion.dev/docs/ai/system-prompt' },
  { id: 'readme', href: 'https://github.com/heristop/leclap#-why-leclap' },
] as const;

/** A table cell: the verdict glyph (with a text label for screen readers) plus the qualifying note. */
const Cell = ({ verdict, label, note }: { verdict: Verdict | 'none'; label: string; note: string }) => {
  if (verdict === 'none') {
    return <span className="text-sm leading-relaxed text-gray-400">{note}</span>;
  }

  const Icon = VERDICT_ICON[verdict];

  return (
    <span className="flex items-start gap-2.5">
      <span role="img" aria-label={label} className={cn('mt-0.5 shrink-0', VERDICT_TONE[verdict])}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="text-sm leading-relaxed text-gray-400">{note}</span>
    </span>
  );
};

/** One "choose X when…" card. `scope` selects which of the two lists the id belongs to. */
const ReasonCard = ({ scope, id }: { scope: 'chooseRemotion' | 'chooseLeClap'; id: string }) => {
  const { t } = useTranslation('compare');

  return (
    <div className="glass-panel-dark h-full rounded-2xl p-6">
      <h3 className="mb-2 text-lg font-semibold text-foreground">{t(`remotion.${scope}.${id}.title`)}</h3>
      <p className="text-sm leading-relaxed text-gray-400">{t(`remotion.${scope}.${id}.body`)}</p>
    </div>
  );
};

export const CompareRemotion = () => {
  const { t } = useTranslation('compare');
  const verdictLabel = {
    yes: t('remotion.table.yes'),
    no: t('remotion.table.no'),
    partial: t('remotion.table.partial'),
  };

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
        <div className="max-w-4xl mx-auto">
          <header className="text-center mb-14 fade-in">
            <Badge variant="brand" className="mb-6 px-4 py-1.5 tracking-[0.18em]">
              {t('remotion.badge')}
            </Badge>
            <div className="mb-6 overflow-x-clip">
              <KineticHeading text={t('remotion.title')} as="h1" level="hero" align="center" />
            </div>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">{t('remotion.tagline')}</p>
          </header>

          <Reveal>
            <h2 className="mb-4 text-xl font-semibold text-foreground">{t('remotion.table.heading')}</h2>
            <div className="overflow-x-auto rounded-2xl border border-divider bg-surface/60">
              <table className="w-full min-w-[44rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-divider bg-foreground/[0.025] text-[0.7rem] uppercase tracking-wider text-gray-500">
                    <th scope="col" className="px-4 py-3 font-semibold">
                      {t('remotion.table.criterion')}
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold text-brand-700 dark:text-brand-300">
                      {t('remotion.table.leclap')}
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      {t('remotion.table.remotion')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row) => (
                    <tr key={row.id} className="border-b border-divider/60 align-top last:border-0">
                      <th scope="row" className="px-4 py-4 text-sm font-medium text-foreground">
                        {t(`remotion.table.${row.id}.label`)}
                      </th>
                      <td className="bg-brand-500/[0.05] px-4 py-4">
                        <Cell
                          verdict={row.leclap}
                          label={row.leclap === 'none' ? '' : verdictLabel[row.leclap]}
                          note={t(`remotion.table.${row.id}.leclap`)}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <Cell
                          verdict={row.remotion}
                          label={row.remotion === 'none' ? '' : verdictLabel[row.remotion]}
                          note={t(`remotion.table.${row.id}.remotion`)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>

          <Reveal delay={120} className="mt-6">
            <div className="rounded-2xl border border-divider bg-surface/40 p-6">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
                {t('remotion.caveats.title')}
              </h2>
              <p className="mb-3 text-sm leading-relaxed text-gray-400">{t('remotion.caveats.leclap')}</p>
              <p className="text-sm leading-relaxed text-gray-400">{t('remotion.caveats.remotion')}</p>
            </div>
          </Reveal>

          <section className="mt-16">
            <Reveal>
              <h2 className="text-2xl font-semibold text-foreground">{t('remotion.chooseRemotion.title')}</h2>
              <p className="mt-2 mb-6 text-gray-400">{t('remotion.chooseRemotion.lead')}</p>
            </Reveal>
            <div className="grid gap-5 sm:grid-cols-2">
              {REMOTION_WINS.map((id, index) => (
                <Reveal key={id} delay={index * 80} scale>
                  <ReasonCard scope="chooseRemotion" id={id} />
                </Reveal>
              ))}
            </div>
          </section>

          <section className="mt-16">
            <Reveal>
              <h2 className="text-2xl font-semibold text-foreground">{t('remotion.chooseLeClap.title')}</h2>
              <p className="mt-2 mb-6 text-gray-400">{t('remotion.chooseLeClap.lead')}</p>
            </Reveal>
            <div className="grid gap-5 sm:grid-cols-2">
              {LECLAP_WINS.map((id, index) => (
                <Reveal key={id} delay={index * 80} scale>
                  <ReasonCard scope="chooseLeClap" id={id} />
                </Reveal>
              ))}
            </div>
          </section>

          <Reveal delay={160} className="mt-16">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
              {t('remotion.sources.title')}
            </h2>
            <p className="mb-4 text-sm leading-relaxed text-gray-400">{t('remotion.sources.lead')}</p>
            <ul className="space-y-2">
              {SOURCES.map((source) => (
                <li key={source.id}>
                  <a
                    href={source.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-1.5 text-sm text-brand-700 underline-offset-4 hover:underline dark:text-brand-300"
                  >
                    {t(`remotion.sources.${source.id}`)}
                    <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5" />
                  </a>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={240} className="mt-16 text-center">
            <p className="text-gray-400 mb-6">{t('remotion.cta.prompt')}</p>
            <Button asChild size="lg" className="group rounded-full lift">
              <Link to="/studio">
                {t('remotion.cta.start')}
                <ArrowRight className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </Reveal>
        </div>
      </div>
    </div>
  );
};
