import React, { forwardRef } from 'react';
import { Globe } from '@/presentation/components/icons';
import { UsersIcon } from '@/presentation/components/icons/users';
import { CogIcon } from '@/presentation/components/icons/cog';
import { ZapIcon } from '@/presentation/components/icons/zap';
import { FileTextIcon } from '@/presentation/components/icons/file-text';
import { ShieldCheckIcon } from '@/presentation/components/icons/shield-check';
import { useIconHover, type AnimatedIconHandle } from '@/presentation/components/icons/useIconHover';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Reveal } from '@/presentation/components/ui';

type AnimIcon = React.ForwardRefExoticComponent<{ className?: string } & React.RefAttributes<AnimatedIconHandle>>;

const GlobeIcon = forwardRef<AnimatedIconHandle, { className?: string }>(({ className }, _ref) => (
  <Globe className={className} />
));
GlobeIcon.displayName = 'GlobeIcon';

const features: { id: string; Icon: AnimIcon }[] = [
  { id: 'templates', Icon: FileTextIcon as unknown as AnimIcon },
  { id: 'forms', Icon: UsersIcon as unknown as AnimIcon },
  { id: 'processing', Icon: CogIcon as unknown as AnimIcon },
  { id: 'privacy', Icon: ShieldCheckIcon as unknown as AnimIcon },
  { id: 'wasm', Icon: ZapIcon as unknown as AnimIcon },
  { id: 'crossPlatform', Icon: GlobeIcon },
];

interface FeatureCardProps {
  id: string;
  Icon: AnimIcon;
}

const FeatureCard = ({ id, Icon }: FeatureCardProps) => {
  const { t } = useTranslation('home');
  const { ref, hoverProps } = useIconHover();

  return (
    <Card
      elevation="flat"
      gradientBorder
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
        e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
      }}
      className="group spotlight relative h-full bg-surface/40 p-6 transition-all duration-300 hover:border-brand-500/40 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-500/10"
      {...hoverProps}
    >
      <div className="flex items-center gap-4 mb-4">
        <span className="grid place-items-center w-12 h-12 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:bg-brand-500/20 group-hover:scale-105 group-hover:-rotate-6">
          <Icon className="w-6 h-6" ref={ref} />
        </span>
        <div className="min-w-0">
          <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-brand-600/80 dark:text-brand-300/70">
            {t(`features.items.${id}.highlight`)}
          </span>
          <h3 className="text-lg font-bold font-display text-foreground leading-tight">
            {t(`features.items.${id}.title`)}
          </h3>
        </div>
      </div>
      <p className="text-sm text-gray-400 leading-relaxed">{t(`features.items.${id}.description`)}</p>
    </Card>
  );
};

export const FeaturesSection = () => {
  const { t } = useTranslation('home');

  return (
    <section id="features" className="relative overflow-hidden py-10 sm:py-16 lg:py-24">
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute -top-24 right-0 h-80 w-80 rounded-full bg-brand-500/10 blur-[120px]" />
        <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-secondary-500/10 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4">
        <Reveal className="max-w-2xl mb-10 sm:mb-14" rootMargin="0px" threshold={0.2}>
          <Badge variant="brand" className="tracking-[0.18em]">
            {t('features.badge')}
          </Badge>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold font-display text-foreground tracking-tight">
            {t('features.title')}
          </h2>
          <p className="mt-3 text-lg text-gray-400 leading-relaxed">{t('features.subtitle')}</p>
        </Reveal>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ id, Icon }, index) => (
            <Reveal key={id} delay={index * 80} className="h-full" rootMargin="0px" threshold={0.2}>
              <FeatureCard id={id} Icon={Icon} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};
