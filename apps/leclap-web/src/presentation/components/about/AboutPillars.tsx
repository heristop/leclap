import { Shield, Zap, Cpu } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const pillars = [
  { id: 'private', icon: Shield },
  { id: 'ffmpeg', icon: Cpu },
  { id: 'templates', icon: Zap },
] as const;

export const AboutPillars = () => {
  const { t } = useTranslation('about');

  return (
    <div className="grid gap-5 sm:grid-cols-3 mb-16">
      {pillars.map(({ id, icon: Icon }, index) => (
        <div
          key={id}
          className="group glass-panel-dark rounded-2xl p-6 lift fade-in"
          style={{ animationDelay: `${0.15 + index * 0.08}s` }}
        >
          <div className="inline-flex p-3 mb-4 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300 group-hover:bg-brand-500/20 transition-colors duration-300">
            <Icon className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">{t(`pillars.${id}.title`)}</h3>
          <p className="text-sm text-gray-400 leading-relaxed">{t(`pillars.${id}.description`)}</p>
        </div>
      ))}
    </div>
  );
};
