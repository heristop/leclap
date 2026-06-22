import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { StudioSurface } from '@/presentation/components/StudioSurface';
import { TemplateSelector } from '@/presentation/components/TemplateSelector';
import { BrowserCompatibility } from '@/presentation/components/BrowserCompatibility';
import { Seo } from '@/presentation/components/Seo';
import type { Template } from '@/services/templateService';

// The studio home: the template gallery on a dark app surface. Picking a template navigates to the
// editor (`/studio/new?template=<id>`) with a View Transition — TemplateSelector tags the card title
// so it morphs into the editor titlebar. Legacy `/studio?projectId=…` links forward to the editor.
export const StudioHome = () => {
  const { t } = useTranslation('builder');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Old project links pointed at `/studio?projectId=…[&edit=1]`; the editor now lives at /studio/new.
  if (searchParams.get('projectId')) {
    return <Navigate to={`/studio/new?${searchParams.toString()}`} replace />;
  }

  const onTemplateSelected = (template: Template) => {
    Promise.resolve(navigate(`/studio/new?template=${template.id}`, { viewTransition: true })).catch(() => {});
  };

  const onBuildFromScratch = () => {
    Promise.resolve(navigate('/studio/builder')).catch(() => {});
  };

  return (
    <StudioSurface kicker={t('studio.home.kicker')} title={t('studio.home.title')} subtitle={t('studio.home.subtitle')}>
      <Seo
        title={t('studio.title', { ns: 'seo' })}
        description={t('studio.description', { ns: 'seo' })}
        path="/studio"
      />
      <BrowserCompatibility />
      <TemplateSelector
        selectedTemplate={null}
        onTemplateSelected={onTemplateSelected}
        onBuildFromScratch={onBuildFromScratch}
      />
    </StudioSurface>
  );
};
