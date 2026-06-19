import { MonitorSmartphone, ShieldCheck, Sparkles } from '@/presentation/components/icons';
import { useTranslation } from 'react-i18next';

const stats = [
  { id: 'browser', value: '100%', icon: MonitorSmartphone },
  { id: 'uploads', value: '0', icon: ShieldCheck },
  { id: 'projects', value: '∞', icon: Sparkles },
] as const;

export const AboutStats = () => {
  const { t } = useTranslation('about');

  return (
    <div className="glass-panel-dark rounded-2xl p-6 sm:p-8 mb-16">
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4">
        {stats.map(({ id, value, icon: Icon }) => (
          <div
            key={id}
            className="group flex flex-col items-center gap-2.5 rounded-2xl px-4 py-6 text-center transition-colors hover:bg-foreground/[0.03]"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500/10 text-brand-700 ring-1 ring-brand-500/20 transition-transform duration-300 ease-[var(--ease-spring)] group-hover:-translate-y-0.5 group-hover:scale-105 dark:text-brand-300">
              <Icon className="h-5 w-5" />
            </span>
            <dt className="font-display text-4xl font-bold leading-none brand-gradient-text md:text-5xl">{value}</dt>
            <dd className="text-xs font-semibold uppercase tracking-widest text-gray-400">{t(`stats.${id}`)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};
