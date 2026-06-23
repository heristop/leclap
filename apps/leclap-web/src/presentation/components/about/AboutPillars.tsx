import { forwardRef, type ForwardRefExoticComponent, type RefAttributes } from 'react';
import { Shield } from '@/presentation/components/icons';
import { ZapIcon } from '@/presentation/components/icons/zap';
import { CpuIcon } from '@/presentation/components/icons/cpu';
import { useIconHover, type AnimatedIconHandle } from '@/presentation/components/icons/useIconHover';
import { useTranslation } from 'react-i18next';
import { Reveal } from '@/presentation/components/ui';

type AnimIcon = ForwardRefExoticComponent<{ className?: string } & RefAttributes<AnimatedIconHandle>>;

// Shield has no animated variant; this shim accepts (and ignores) the handle ref so it can sit in the
// same typed list as the animated icons without throwing when useIconHover calls its handle.
const ShieldIcon = forwardRef<AnimatedIconHandle, { className?: string }>(({ className }, _ref) => (
  <Shield className={className} />
));
ShieldIcon.displayName = 'ShieldIcon';

const pillars: { id: string; Icon: AnimIcon }[] = [
  { id: 'private', Icon: ShieldIcon },
  { id: 'ffmpeg', Icon: CpuIcon as unknown as AnimIcon },
  { id: 'templates', Icon: ZapIcon as unknown as AnimIcon },
];

interface PillarCardProps {
  id: string;
  Icon: AnimIcon;
}

const PillarCard = ({ id, Icon }: PillarCardProps) => {
  const { t } = useTranslation('about');
  const { ref, hoverProps } = useIconHover();

  return (
    <div className="group glass-panel-dark rounded-2xl p-6 lift h-full" {...hoverProps}>
      <div className="inline-flex p-3 mb-4 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300 group-hover:bg-brand-500/20 transition-colors duration-300">
        <Icon className="w-6 h-6" ref={ref} />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{t(`pillars.${id}.title`)}</h3>
      <p className="text-sm text-gray-400 leading-relaxed">{t(`pillars.${id}.description`)}</p>
    </div>
  );
};

// Each card reveals on scroll with an 80ms cascade. The reveal wrapper and the inner card are kept
// separate so `Reveal`'s long entrance transition never overrides the snappy `lift` hover transition.
export const AboutPillars = () => (
  <div className="grid gap-5 sm:grid-cols-3 mb-16">
    {pillars.map(({ id, Icon }, index) => (
      <Reveal key={id} delay={index * 80}>
        <PillarCard id={id} Icon={Icon} />
      </Reveal>
    ))}
  </div>
);
