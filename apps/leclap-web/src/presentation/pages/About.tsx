import { ArrowRight } from '@/presentation/components/icons';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AboutStory } from '@/presentation/components/about/about-story';
import { AboutAuthor } from '@/presentation/components/about/AboutAuthor';
import { AboutThanks } from '@/presentation/components/about/AboutThanks';
import { ClappyReaction } from '@/presentation/components/clappy';
import { Seo } from '@/presentation/components/Seo';
import { KineticHeading } from '@/presentation/components/kinetic';
import { Button, Reveal } from '@/presentation/components/ui';

// The about page tells the product's story rather than listing features the landing already shows: what
// LeClap is (the hero), how it got here (the dated story), who makes it, and what it stands on (FFmpeg).
// overflow-x-clip, not overflow-hidden: a hidden overflow would become the box the story's pinned
// heading sticks to, and it would scroll away with the page.
export const About = () => {
  const { t } = useTranslation('about');

  return (
    <div className="relative min-h-screen overflow-x-clip bg-background pt-24 pb-20 text-foreground">
      <Seo title={t('about.title', { ns: 'seo' })} description={t('about.description', { ns: 'seo' })} path="/about" />
      {/* Ambient background — living brand aurora that slowly drifts. Frozen under the global
          reduced-motion reset. */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="animate-aurora absolute top-0 left-1/4 h-96 w-96 rounded-full bg-brand-500/10 blur-[120px]" />
        <div className="animate-aurora absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-secondary-500/10 blur-[120px] [animation-delay:-9s]" />
      </div>

      <div className="container relative z-10 mx-auto px-4">
        <header className="mx-auto max-w-3xl text-center fade-in">
          {/* Clappy's one appearance in the page: the welcome, a wave that ends in a raised hand. Small
              enough that the headline stays the loudest thing here; decorative, the words carry it. */}
          <ClappyReaction reaction="wave" size={84} className="mb-4" />
          <p className="-mr-[0.3em] text-xs font-semibold uppercase tracking-[0.3em] text-brand-700 dark:text-brand-300">
            {t('hero.eyebrow')}
          </p>
          {/* Oversized Oswald hero in ink — the kinetic word-by-word reveal, with the gradient reserved for
              the moments that matter (the playhead, the call to action) rather than the display type. */}
          <div className="mt-5 mb-6 overflow-x-clip">
            <KineticHeading text={t('hero.title')} as="h1" level="hero" align="center" />
          </div>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-balance text-gray-400 sm:text-xl">
            {t('hero.tagline')}
          </p>
        </header>

        <div className="mt-24 sm:mt-32">
          <AboutStory />
        </div>

        <div className="mx-auto mt-24 max-w-4xl sm:mt-32">
          <Reveal>
            <AboutAuthor />
          </Reveal>

          <Reveal delay={120}>
            <AboutThanks />
          </Reveal>

          {/* One primary action; the comparison is a quieter next read, and the only way into that page
              from the site itself. */}
          <Reveal delay={200} className="mt-20 text-center">
            <p className="mb-6 text-gray-400">{t('cta.prompt')}</p>
            <Button asChild size="lg" className="group rounded-full lift">
              <Link to="/studio">
                {t('cta.start')}
                <ArrowRight className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <p className="mt-5">
              <Link
                to="/compare/remotion"
                className="group inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-brand-700 transition-colors hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200"
              >
                {t('cta.compare')}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </p>
          </Reveal>
        </div>
      </div>
    </div>
  );
};
