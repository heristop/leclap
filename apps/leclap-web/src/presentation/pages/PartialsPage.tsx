import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from '@/presentation/components/icons';
import type { TemplatePartial } from '@leclap/creative-kit/partials';
import { Seo } from '@/presentation/components/Seo';
import { Button } from '@/presentation/components/ui';
import { StudioSurface } from '@/presentation/components/StudioSurface';
import { PartialsEditor } from '@/presentation/components/admin/PartialsEditor';

type PartialsLocationState = {
  partialDraft?: TemplatePartial;
};

// Shares the studio app surface (dark stage + editor-style titlebar) with the Templates/Projects
// pages so the templates ↔ partials pair reads as one workspace.
export const PartialsPage = () => {
  const { t } = useTranslation('admin');
  const location = useLocation();
  const routeState = location.state as PartialsLocationState | null;

  return (
    <StudioSurface
      title={t('partials.title')}
      subtitle={t('partials.subtitle')}
      actions={
        <Button asChild variant="outline" className="group rounded-full">
          <Link to="/templates">
            <ArrowLeft className="transition-transform duration-300 group-hover:-translate-x-1 motion-reduce:transition-none" />
            {t('partials.back')}
          </Link>
        </Button>
      }
    >
      <Seo title={t('partials.title')} path="/partials" noindex />
      <PartialsEditor initialDraft={routeState?.partialDraft ?? null} />
    </StudioSurface>
  );
};
