import { MonitorSmartphone, ShieldCheck, Sparkles } from 'lucide-react';

const stats = [
  { value: '100%', label: 'Runs in your browser', icon: MonitorSmartphone },
  { value: '0', label: 'Files uploaded', icon: ShieldCheck },
  { value: '∞', label: 'Projects, always free', icon: Sparkles },
];

export const AboutStats = () => {
  return (
    <div className="glass-panel-dark rounded-2xl p-6 sm:p-8 mb-16 fade-in" style={{ animationDelay: '0.1s' }}>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4">
        {stats.map(({ value, label, icon: Icon }) => (
          <div
            key={label}
            className="group flex flex-col items-center gap-2.5 rounded-2xl px-4 py-6 text-center transition-colors hover:bg-foreground/[0.03]"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500/10 text-brand-700 ring-1 ring-brand-500/20 transition-transform duration-300 ease-[var(--ease-spring)] group-hover:-translate-y-0.5 group-hover:scale-105 dark:text-brand-300">
              <Icon className="h-5 w-5" />
            </span>
            <dt className="font-display text-4xl font-bold leading-none brand-gradient-text md:text-5xl">{value}</dt>
            <dd className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};
