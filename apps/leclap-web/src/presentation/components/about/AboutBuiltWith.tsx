import { useTranslation } from 'react-i18next';

// Tech names are proper nouns (kept in code); the descriptive note is translated.
const stack = [
  { id: 'react', name: 'React 19', accent: 'text-brand-600 dark:text-brand-300' },
  { id: 'ffmpeg', name: 'FFmpeg.wasm', accent: 'text-secondary-600 dark:text-secondary-300' },
  { id: 'tailwind', name: 'Tailwind CSS 4', accent: 'text-amber-600 dark:text-accent-400' },
] as const;

export const AboutBuiltWith = () => {
  const { t } = useTranslation('about');

  return (
    <div className="mt-16">
      <h2 className="text-center text-sm font-semibold uppercase tracking-[0.18em] text-gray-500 mb-6">
        {t('builtWith.title')}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px overflow-hidden rounded-2xl glass-panel-dark">
        {stack.map(({ id, name, accent }) => (
          <div
            key={id}
            className="px-6 py-5 text-center bg-foreground/0 hover:bg-foreground/5 transition-colors duration-300"
          >
            <p className={`text-lg font-bold font-display ${accent}`}>{name}</p>
            <p className="text-sm text-gray-500 mt-1">{t(`builtWith.${id}`)}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
