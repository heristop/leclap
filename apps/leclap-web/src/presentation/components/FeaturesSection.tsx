import React, { forwardRef } from 'react';
import { Globe } from '@/presentation/components/icons';
import { UsersIcon } from '@/presentation/components/icons/users';
import { CogIcon } from '@/presentation/components/icons/cog';
import { ZapIcon } from '@/presentation/components/icons/zap';
import { FileTextIcon } from '@/presentation/components/icons/file-text';
import { ShieldCheckIcon } from '@/presentation/components/icons/shield-check';
import { useIconHover, type AnimatedIconHandle } from '@/presentation/components/icons/useIconHover';
import { useTranslation } from 'react-i18next';
import { Reveal } from '@/presentation/components/ui';
import { SectionHeading } from '@/presentation/components/home/section-heading';

type AnimIcon = React.ForwardRefExoticComponent<{ className?: string } & React.RefAttributes<AnimatedIconHandle>>;

const GlobeIcon = forwardRef<AnimatedIconHandle, { className?: string }>(({ className }, _ref) => (
  <Globe className={className} />
));
GlobeIcon.displayName = 'GlobeIcon';

const features: { id: string; Icon: AnimIcon }[] = [
  { id: 'templates', Icon: FileTextIcon },
  { id: 'forms', Icon: UsersIcon },
  { id: 'processing', Icon: CogIcon },
  { id: 'privacy', Icon: ShieldCheckIcon },
  { id: 'wasm', Icon: ZapIcon },
  { id: 'crossPlatform', Icon: GlobeIcon },
];

interface FeatureItemProps {
  id: string;
  Icon: AnimIcon;
}

// One line of the spec sheet: a hairline, the icon, a title and one precise sentence. No card, border glow or
// hover lift — nothing here is clickable, so nothing pretends to be; only the icon's own hover animation plays.
const FeatureItem = ({ id, Icon }: FeatureItemProps) => {
  const { t } = useTranslation('home');
  const { ref, hoverProps } = useIconHover();

  return (
    <div className="h-full border-t border-divider pt-7 pb-9" {...hoverProps}>
      <Icon className="size-6 text-brand-600 dark:text-brand-300" ref={ref} />
      <h3 className="mt-5 font-display text-xl font-bold uppercase leading-tight tracking-[0.02em] text-foreground">
        {t(`features.items.${id}.title`)}
      </h3>
      <p className="mt-2 max-w-sm leading-relaxed text-gray-400 text-pretty">{t(`features.items.${id}.description`)}</p>
    </div>
  );
};

// The page's coda: what the composer is, as a spec sheet under the same heading as every other section.
export const FeaturesSection = () => {
  const { t } = useTranslation('home');

  return (
    <section id="features" className="relative bg-background py-24 text-foreground sm:py-32">
      {/* A soft pool of the brand pink low on the left, fading out well inside the section: no edge to clip. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(45%_40%_at_18%_72%,rgba(255,138,174,0.07),transparent_70%)]"
      />
      <SectionHeading eyebrow={t('features.badge')} title={t('features.title')} subtitle={t('features.subtitle')} />

      <ul className="relative mx-auto mt-14 grid w-full max-w-6xl grid-cols-1 gap-x-10 px-4 sm:mt-20 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 lg:gap-x-14">
        {features.map(({ id, Icon }, index) => (
          <li key={id}>
            <Reveal
              delay={(index % 3) * 70}
              className="h-full ease-[var(--ease-out-expo)]"
              rootMargin="0px"
              threshold={0.2}
            >
              <FeatureItem id={id} Icon={Icon} />
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
};
