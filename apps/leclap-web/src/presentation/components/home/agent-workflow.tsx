import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Reveal } from '@/presentation/components/ui';
import { ArrowUpRight } from '@/presentation/components/icons';

const steps = ['compose', 'validate', 'revise', 'render'] as const;
const useCases = [
  { id: 'product', to: '/showcase' },
  { id: 'social', to: '/showcase' },
  { id: 'review', to: '/doc/mcp#agentic-review' },
] as const;

export const AgentWorkflow = () => {
  const { t } = useTranslation('home');

  return (
    <section id="agent-workflow" className="bg-background py-24 text-foreground sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-20">
          <Reveal rootMargin="0px" threshold={0.15}>
            <h2 className="max-w-[12ch] font-display text-[length:var(--text-display-section)] font-bold uppercase leading-[0.95] tracking-[-0.015em] text-balance [&:not(:lang(en))]:leading-[1.16]">
              {t('workflow.title')}
            </h2>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">{t('workflow.subtitle')}</p>
            <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
              <Button asChild size="lg">
                <Link to="/doc/agents">{t('workflow.guide')}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/studio">{t('workflow.studio')}</Link>
              </Button>
            </div>
          </Reveal>
          <ol className="border-t border-divider">
            {steps.map((step, index) => (
              <li key={step} className="border-b border-divider">
                <Reveal
                  rootMargin="0px"
                  threshold={0.2}
                  className="grid grid-cols-[2rem_minmax(0,1fr)] gap-4 py-6 sm:gap-6"
                >
                  <span className="pt-1 text-sm tabular-nums text-brand-700 dark:text-brand-300" aria-hidden="true">
                    0{index + 1}
                  </span>
                  <div>
                    <h3 className="font-display text-2xl font-bold">{t(`workflow.steps.${step}.title`)}</h3>
                    <p className="mt-2 max-w-lg leading-relaxed text-muted-foreground">
                      {t(`workflow.steps.${step}.body`)}
                    </p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
        <ul className="mt-14 grid gap-8 border-t border-divider pt-8 md:grid-cols-3 lg:mt-20">
          {useCases.map(({ id, to }) => (
            <li key={id} className="group min-w-0">
              <Reveal rootMargin="0px" threshold={0.2}>
                <h3 className="font-display text-xl font-bold">
                  <Link
                    className="inline-flex min-h-11 items-center gap-2 underline decoration-primary/40 underline-offset-4 transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-primary"
                    to={to}
                  >
                    {t(`workflow.cases.${id}.title`)}
                    <ArrowUpRight size={18} aria-hidden="true" className="shrink-0" />
                  </Link>
                </h3>
                <p className="mt-3 leading-relaxed text-muted-foreground">{t(`workflow.cases.${id}.body`)}</p>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
