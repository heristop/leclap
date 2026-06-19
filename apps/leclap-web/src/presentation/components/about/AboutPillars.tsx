import { Shield, Zap, Cpu } from '@/presentation/components/icons';
import { useTranslation } from 'react-i18next';
import { Reveal } from '@/presentation/components/ui';

const pillars = [
  { id: 'private', icon: Shield },
  { id: 'ffmpeg', icon: Cpu },
  { id: 'templates', icon: Zap },
] as const;

export const AboutPillars = () => {
  const { t } = useTranslation('about');

  // Each card reveals on scroll with an 80ms cascade. The reveal wrapper and the inner card
  // are kept separate so `Reveal`'s long entrance transition never overrides the snappy `lift`
  // hover transition.
  return (
    <div className="grid gap-5 sm:grid-cols-3 mb-16">
      {pillars.map(({ id, icon: Icon }, index) => (
        <Reveal key={id} delay={index * 80}>
          <div className="group glass-panel-dark rounded-2xl p-6 lift h-full">
            <div className="inline-flex p-3 mb-4 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300 group-hover:bg-brand-500/20 transition-colors duration-300">
              <Icon className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">{t(`pillars.${id}.title`)}</h3>
            <p className="text-sm text-gray-400 leading-relaxed">{t(`pillars.${id}.description`)}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
};
