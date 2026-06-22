import { useTranslation } from 'react-i18next';
import { ResponsivePromoShowcase } from './ResponsivePromoShowcase';

// The video-creation promo (a Remotion video built from real /studio screen-recordings: pick a template,
// drop in a clip, render), shown on the home page responsively — landscape on desktop, portrait on phones.
export const CreateShowcase = () => {
  const { t } = useTranslation('home');

  return (
    <ResponsivePromoShowcase
      landscape={{ webm: '/videos/leclap-create-promo.webm', mp4: '/videos/leclap-create-promo.mp4' }}
      portrait={{ webm: '/videos/leclap-create-promo-portrait.webm', mp4: '/videos/leclap-create-promo-portrait.mp4' }}
      eyebrow={t('createShowcase.eyebrow')}
      title={t('createShowcase.title')}
      subtitle={t('createShowcase.subtitle')}
      badge={t('createShowcase.badge')}
      videoAria={t('createShowcase.videoAria')}
      cta={t('createShowcase.cta')}
      ctaTo="/studio"
      mediaSide="left"
    />
  );
};
