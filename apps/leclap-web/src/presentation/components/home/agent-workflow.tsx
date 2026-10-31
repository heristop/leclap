import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/presentation/components/ui';
import { SectionHeading } from './section-heading';

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
      <SectionHeading eyebrow={t('workflow.eyebrow')} title={t('workflow.title')} subtitle={t('workflow.subtitle')} />
      <div className="mx-auto mt-14 max-w-6xl px-6">
        <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <li key={step} className="border-t border-divider pt-6">
              <span className="font-mono text-sm text-brand-600 dark:text-brand-300" aria-hidden="true">
                0{index + 1}
              </span>
              <h3 className="mt-4 font-display text-2xl font-bold">{t(`workflow.steps.${step}.title`)}</h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">{t(`workflow.steps.${step}.body`)}</p>
            </li>
          ))}
        </ol>
        <ul className="mt-16 grid gap-8 md:grid-cols-3">
          {useCases.map(({ id, to }) => (
            <li key={id} className="border-t border-divider pt-6">
              <h3 className="font-display text-xl font-bold">
                <Link className="underline decoration-primary underline-offset-4 hover:text-primary" to={to}>
                  {t(`workflow.cases.${id}.title`)}
                </Link>
              </h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">{t(`workflow.cases.${id}.body`)}</p>
            </li>
          ))}
        </ul>
        <div className="mt-12 flex flex-wrap justify-center gap-4">
          <Button asChild size="lg">
            <Link to="/doc/agents">{t('workflow.guide')}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/studio">{t('workflow.studio')}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};
