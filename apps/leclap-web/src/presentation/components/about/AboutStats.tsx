import { forwardRef, type ForwardRefExoticComponent, type RefAttributes } from 'react';
import { MonitorSmartphone } from '@/presentation/components/icons';
import { ShieldCheckIcon } from '@/presentation/components/icons/shield-check';
import { SparklesIcon } from '@/presentation/components/icons/sparkles';
import { useIconHover, type AnimatedIconHandle } from '@/presentation/components/icons/useIconHover';
import { useTranslation } from 'react-i18next';

type AnimIcon = ForwardRefExoticComponent<{ className?: string } & RefAttributes<AnimatedIconHandle>>;

// MonitorSmartphone has no animated variant; this shim accepts (and ignores) the handle ref so it can
// sit in the same typed list as the animated icons without throwing when useIconHover calls its handle.
const MonitorIcon = forwardRef<AnimatedIconHandle, { className?: string }>(({ className }, _ref) => (
  <MonitorSmartphone className={className} />
));
MonitorIcon.displayName = 'MonitorIcon';

const stats: { id: string; value: string; Icon: AnimIcon }[] = [
  { id: 'browser', value: '100%', Icon: MonitorIcon },
  { id: 'uploads', value: '0', Icon: ShieldCheckIcon as unknown as AnimIcon },
  { id: 'projects', value: '∞', Icon: SparklesIcon as unknown as AnimIcon },
];

interface StatCardProps {
  id: string;
  value: string;
  Icon: AnimIcon;
}

const StatCard = ({ id, value, Icon }: StatCardProps) => {
  const { t } = useTranslation('about');
  const { ref, hoverProps } = useIconHover();

  return (
    <div
      className="group flex flex-col items-center gap-2.5 rounded-2xl px-4 py-6 text-center transition-colors hover:bg-foreground/[0.03]"
      {...hoverProps}
    >
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500/10 text-brand-700 ring-1 ring-brand-500/20 transition-transform duration-300 ease-[var(--ease-spring)] group-hover:-translate-y-0.5 group-hover:scale-105 dark:text-brand-300">
        <Icon className="h-5 w-5" ref={ref} />
      </span>
      <dt className="font-display text-4xl font-bold leading-none brand-gradient-text md:text-5xl">{value}</dt>
      <dd className="text-xs font-semibold uppercase tracking-widest text-gray-400">{t(`stats.${id}`)}</dd>
    </div>
  );
};

export const AboutStats = () => (
  <div className="glass-panel-dark rounded-2xl p-6 sm:p-8 mb-16">
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4">
      {stats.map(({ id, value, Icon }) => (
        <StatCard key={id} id={id} value={value} Icon={Icon} />
      ))}
    </dl>
  </div>
);
