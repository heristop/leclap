import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import type { TemplatePartial } from '@leclap/creative-kit/partials';
import { Seo } from '@/presentation/components/Seo';
import { Button } from '@/presentation/components/ui';
import { PartialsEditor } from '@/presentation/components/admin/PartialsEditor';

type PartialsLocationState = {
  partialDraft?: TemplatePartial;
};

// Shares the Templates page shell (dotted field + brand glow + max-w-6xl column) so the
// templates ↔ partials pair reads as one workspace rather than two unrelated screens.
export const PartialsPage = () => {
  const { t } = useTranslation('admin');
  const location = useLocation();
  const routeState = location.state as PartialsLocationState | null;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background bg-dots text-foreground">
      <Seo title={t('partials.title')} path="/partials" noindex />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-1/4 h-96 w-96 rounded-full bg-brand-500/10 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pt-24 pb-16">
        <Button
          asChild
          variant="ghost"
          className="group mb-4 -ml-2 rounded-full px-3 text-gray-500 hover:text-foreground dark:text-gray-400"
        >
          <Link to="/templates">
            <ArrowLeft className="transition-transform duration-300 group-hover:-translate-x-1" /> {t('partials.back')}
          </Link>
        </Button>

        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="mb-1 text-4xl font-bold font-display text-foreground">{t('partials.title')}</h1>
            <p className="max-w-2xl text-gray-600 dark:text-gray-300">{t('partials.subtitle')}</p>
          </div>
        </div>

        <PartialsEditor initialDraft={routeState?.partialDraft ?? null} />
      </div>
    </div>
  );
};
