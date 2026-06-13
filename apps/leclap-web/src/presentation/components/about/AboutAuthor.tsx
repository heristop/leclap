import { Globe, Code2, AtSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const socials = [
  { id: 'website', icon: Globe, href: 'https://heristop.github.io' },
  { id: 'github', icon: Code2, href: 'https://github.com/heristop' },
  { id: 'twitter', icon: AtSign, href: 'https://twitter.com/heristop' },
] as const;

export const AboutAuthor = () => {
  const { t } = useTranslation('about');

  return (
    <section className="glass-panel-dark rounded-2xl p-8 md:p-12 shadow-2xl fade-in" style={{ animationDelay: '0.2s' }}>
      <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
        <div className="relative group shrink-0">
          <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-brand-500 to-secondary-500 blur opacity-60 group-hover:opacity-90 transition-opacity duration-500" />
          <img
            src="/images/avatar.webp"
            alt={t('author.avatarAlt')}
            width={144}
            height={144}
            className="relative w-36 h-36 rounded-full object-cover border-4 border-background"
          />
        </div>

        <div className="flex-1 text-center md:text-left">
          <h2 className="text-3xl font-bold text-foreground font-display">{t('author.name')}</h2>
          <p className="text-brand-600 dark:text-brand-300 font-medium mb-4 text-lg">{t('author.handle')}</p>
          <p className="text-gray-300 mb-6 leading-relaxed">{t('author.bio')}</p>

          <div className="flex flex-wrap justify-center md:justify-start gap-3">
            {socials.map(({ id, icon: Icon, href }) => (
              <a
                key={id}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm text-gray-400 hover:text-foreground bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 tap transition-colors duration-300 cursor-pointer"
              >
                <Icon className="w-4 h-4" />
                {t(`author.social.${id}`)}
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
