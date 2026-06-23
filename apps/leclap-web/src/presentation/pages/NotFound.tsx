import { Link } from 'react-router-dom';
import { Home } from '@/presentation/components/icons';
import { CompassIcon } from '@/presentation/components/icons/compass';
import { useTranslation } from 'react-i18next';
import { Seo } from '@/presentation/components/Seo';
import { Button } from '@/presentation/components/ui';
import { useIconHover } from '@/presentation/components/icons/useIconHover';

export const NotFound = () => {
  const { t } = useTranslation('shell');
  const { ref: compassRef, hoverProps: compassHoverProps } = useIconHover();

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background text-foreground relative overflow-hidden flex items-center justify-center px-4">
      <Seo title={t('notFound.seoTitle')} noindex />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[32rem] h-[32rem] bg-brand-500/10 rounded-full blur-[120px] animate-float" />
        <div
          className="absolute bottom-0 right-1/4 w-[26rem] h-[26rem] bg-secondary-400/10 rounded-full blur-[120px] animate-float"
          style={{ animationDelay: '-3s' }}
        />
      </div>

      <div className="relative text-center max-w-md fade-in">
        <p className="text-8xl font-bold font-display brand-gradient-text mb-2">404</p>
        <h1 className="text-2xl font-bold font-display text-foreground mb-2">{t('notFound.title')}</h1>
        <p className="text-gray-300 mb-8">{t('notFound.message')}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg">
            <Link to="/">
              <Home /> {t('notFound.home')}
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
