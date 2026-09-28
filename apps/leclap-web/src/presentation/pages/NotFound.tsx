import { useHref, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Seo } from '@/presentation/components/Seo';
import { NotFoundScene, suggestPath } from '@/presentation/components/error-scene';

export const NotFound = () => {
  const { t } = useTranslation('shell');
  const { pathname } = useLocation();
  // The address bar's form of the path, locale prefix included: the one the visitor typed or followed.
  const shown = useHref(pathname);

  return (
    // `flex-1` fills the space main leaves above the footer, so on a tall screen the scene sits in the middle.
    // The header is fixed over main, hence `pt-24` like every page; `items-center-safe` drops the scene to the
    // top instead of centring it up under the header when the viewport is shorter than the scene.
    <div className="relative flex flex-1 items-center-safe justify-center overflow-hidden bg-background px-4 pb-12 pt-24 text-foreground">
      <Seo title={t('notFound.seoTitle')} noindex />
      <NotFoundScene path={shown} suggestion={suggestPath(pathname)} />
    </div>
  );
};
