import { Link } from 'react-router-dom';
import { HomeIcon } from '@/presentation/components/icons/home';
import { CompassIcon } from '@/presentation/components/icons/compass';
import { useTranslation } from 'react-i18next';
import { Seo } from '@/presentation/components/Seo';
import { Button } from '@/presentation/components/ui';
import { useIconHover } from '@/presentation/components/icons/useIconHover';

export const NotFound = () => {
  const { t } = useTranslation('shell');
  const { ref: compassRef, hoverProps: compassHoverProps } = useIconHover();
  // The hover props go on the Button, not the icon: the whole control is the hit target, so pointing
  // anywhere in it plays the icon's animation — matching the Templates button beside it.
  const { ref: homeRef, hoverProps: homeHoverProps } = useIconHover();

  return (
    // `flex-1` fills the space main leaves between header and footer, so the footer stays on screen
    // instead of sitting one viewport-height down.
    //
    // Keep the padding small. This page's minimum height is what decides whether the footer fits:
    // card (~306px) + this padding + the footer's fixed ~284px. At `py-16` that floor is ~718px and
    // a 1280x800 laptop — ~700px of viewport after browser chrome — crops the footer. `py-8` puts it
    // at ~654px, and the flex centring still spreads the card out on tall screens.
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-background px-4 py-8 text-foreground">
      <Seo title={t('notFound.seoTitle')} noindex />
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute top-1/3 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 animate-float rounded-full bg-brand-500/10 blur-[120px] motion-reduce:animate-none" />
        <div
          className="absolute right-1/4 bottom-0 h-[26rem] w-[26rem] animate-float rounded-full bg-secondary-400/10 blur-[120px] motion-reduce:animate-none"
          style={{ animationDelay: '-3s' }}
        />
      </div>

      {/* Staggered rather than one blanket fade: the number reads first, then what it means, then the
          way out — the order you actually want the eye to travel. ~70ms apart, which is enough to
          feel sequential without making anyone wait. Frozen by the global reduced-motion reset. */}
      <div className="relative max-w-md text-center">
        {/* Decorative: the heading below carries the meaning, so a screen reader reading "404" first
            would just be noise. */}
        <p
          aria-hidden="true"
          className="brand-gradient-text animate-rise-in mb-2 pb-[0.05em] font-display text-8xl leading-[1.1] font-bold tracking-tight"
        >
          404
        </p>
        <h1
          className="animate-rise-in mb-2 font-display text-2xl font-bold text-foreground"
          style={{ animationDelay: '70ms' }}
        >
          {t('notFound.title')}
        </h1>
        <p className="animate-rise-in mb-8 text-muted-foreground" style={{ animationDelay: '140ms' }}>
          {t('notFound.message')}
        </p>
        <div
          className="animate-rise-in flex flex-col justify-center gap-3 sm:flex-row"
          style={{ animationDelay: '210ms' }}
        >
          <Button asChild size="lg" {...homeHoverProps}>
            <Link to="/">
              <HomeIcon ref={homeRef} size={16} /> {t('notFound.home')}
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg" {...compassHoverProps}>
            <Link to="/studio">
              <CompassIcon ref={compassRef} size={16} /> {t('notFound.openBuilder')}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};
