import { HeartIcon } from '@/presentation/components/icons/heart';
import { ArrowUpRightIcon } from '@/presentation/components/icons/arrow-up-right';
import { useTranslation } from 'react-i18next';

// A sincere acknowledgment to the FFmpeg project — the engine every clip, filter and
// transition runs on. Kept deliberately editorial (not a tech badge): an oversized, offset
// heart watermark carries the gratitude, the copy is left-aligned and reads like a note.
export const AboutThanks = () => {
  const { t } = useTranslation('about');

  return (
    <section className="mt-16 relative overflow-hidden rounded-2xl glass-panel-dark p-8 md:p-12">
      <HeartIcon
        aria-hidden="true"
        size={208}
        className="pointer-events-none absolute -right-8 -bottom-10 rotate-12 text-secondary-500/10"
      />

      <div className="relative max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary-600 dark:text-secondary-300">
          {t('thanks.kicker')}
        </p>

        <p className="mt-4 font-display text-2xl md:text-3xl font-semibold leading-snug text-foreground text-balance">
          {t('thanks.lead')}
        </p>

        <p className="mt-4 text-gray-300 leading-relaxed">{t('thanks.body')}</p>

        <a
          href="https://ffmpeg.org"
          target="_blank"
          rel="noopener noreferrer"
          className="group mt-6 inline-flex items-center gap-2 text-sm font-medium text-brand-600 dark:text-brand-300 cursor-pointer"
        >
          {t('thanks.link')}
          <ArrowUpRightIcon
            size={16}
            className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </a>
      </div>
    </section>
  );
};
