import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { StudioSurface } from '@/presentation/components/StudioSurface';
import { TemplateSelector } from '@/presentation/components/TemplateSelector';
import { BrowserCompatibility } from '@/presentation/components/BrowserCompatibility';
import { Seo } from '@/presentation/components/Seo';
import type { Template } from '@/services/templateService';

// The studio home: the template gallery on a dark app surface. Picking a template navigates to the
// editor (`/studio/new?template=<id>`) with a View Transition; TemplateSelector tags the clicked card's
// title so it morphs into the editor titlebar. For that morph to land, the editor title has to exist in
// the very next frame — so we (a) warm the lazy editor chunk and (b) hand the full template through nav
// state, letting the editor render its titlebar synchronously instead of after an async fetch.
export const StudioHome = () => {
  const { t } = useTranslation('builder');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Old project links pointed at `/studio?projectId=…[&edit=1]`; the editor now lives at /studio/new.
  if (searchParams.get('projectId')) {
    return <Navigate to={`/studio/new?${searchParams.toString()}`} replace />;
  }

  const onTemplateSelected = (template: Template) => {
    // Await the editor chunk so the route renders synchronously inside the transition (a lazy Suspense
    // fallback would otherwise be the snapshot the morph captures — i.e. no title to morph into).
    import('@/presentation/pages/Builder')
      .then(() => navigate(`/studio/new?template=${template.id}`, { viewTransition: true, state: { template } }))
      .catch(() => {});
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
