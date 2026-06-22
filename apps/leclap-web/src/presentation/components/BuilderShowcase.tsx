import { useTranslation } from 'react-i18next';
import { ResponsivePromoShowcase } from './ResponsivePromoShowcase';

// The template-builder promo (a Remotion video built from real /templates/new screen-captures), shown on
// the home page responsively — landscape on desktop, portrait on phones.
export const BuilderShowcase = () => {
  const { t } = useTranslation('home');

  return (
    <ResponsivePromoShowcase
      landscape={{ webm: '/videos/leclap-builder-promo.webm', mp4: '/videos/leclap-builder-promo.mp4' }}
      portrait={{
        webm: '/videos/leclap-builder-promo-portrait.webm',
        mp4: '/videos/leclap-builder-promo-portrait.mp4',
      }}
      eyebrow={t('builderShowcase.eyebrow')}
      title={t('builderShowcase.title')}
      subtitle={t('builderShowcase.subtitle')}
      badge={t('builderShowcase.badge')}
      videoAria={t('builderShowcase.videoAria')}
      cta={t('builderShowcase.cta')}
      ctaTo="/templates/new"
      mediaSide="right"
    />
  );
};
