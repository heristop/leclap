import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Play } from '@/presentation/components/icons';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FeaturesSection } from '@/presentation/components/FeaturesSection';
import { HomeShowcase } from '@/presentation/components/HomeShowcase';
import { CreateShowcase } from '@/presentation/components/CreateShowcase';
import { BuilderShowcase } from '@/presentation/components/BuilderShowcase';
import { Seo } from '@/presentation/components/Seo';
import { Button } from '@/presentation/components/ui';
import { useInView } from '@/hooks/useInView';
import { useHeroVideoSrc } from '@/hooks/useHeroVideoSrc';
import { OPEN_ONBOARDING_EVENT } from '@/hooks/useOnboarding';

export const Home = () => {
  const { t } = useTranslation('home');
  // Dimmed background clip behind the hero. Paused for reduced-motion viewers.
  const [reduced] = useState(() => globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches);
  // Stop decoding the blurred hero clip once it scrolls off-screen — a full-frame blurred video
  // composited every frame is the page's heaviest scroll cost, and it's invisible past the fold.
  const [heroRef, heroInView] = useInView({ once: false, threshold: 0 });
  const heroVideoRef = useRef<HTMLVideoElement>(null);
  // The visitor's onboarding-compiled video when they've made one, else the bundled default clip.
  const heroSrc = useHeroVideoSrc();

  useEffect(() => {
    const el = heroVideoRef.current;

    if (!el || reduced) return;

    if (!heroInView) {
      el.pause();

      return;
    }

    el.play().catch(() => {});
  }, [heroInView, reduced, heroSrc]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background text-foreground overflow-hidden">
      <Seo />
      {/* Hero Section — always-dark "stage": force dark tokens regardless of theme */}
      <div ref={heroRef} className="dark relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Cinematic stage: a base gradient, a dimmed/blurred background clip, the image overlay, then
            a vignette that grounds the footage and keeps the hero copy legible. */}
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 opacity-80" />
        <video
          ref={heroVideoRef}
          src={heroSrc}
          className="pointer-events-none absolute inset-0 z-0 h-full w-full scale-105 object-cover opacity-40 blur-[3px]"
          autoPlay={!reduced}
          loop
          muted
          playsInline
          preload="metadata"
          aria-hidden="true"
          tabIndex={-1}
        />
        <div className="absolute inset-0 z-0 bg-[url('https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=2525&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay" />
        {/* Vignette + center-darkening so the footage fades into the stage and the title stays readable. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,transparent_15%,rgba(8,8,14,0.72))]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-t from-background via-transparent to-background/40"
        />

        <div className="container mx-auto px-4 text-center relative z-10">
          <h1
            className="font-display text-6xl sm:text-7xl md:text-9xl font-bold mb-4 sm:mb-6 tracking-tighter fade-in"
            style={{ animationDelay: '0.2s' }}
          >
            <span className="text-gradient-animated">{t('brand', { ns: 'common' })}</span>
          </h1>

          <p
            className="text-xl sm:text-2xl md:text-3xl text-gray-300 mb-8 sm:mb-12 max-w-3xl mx-auto font-light leading-relaxed fade-in"
            style={{ animationDelay: '0.4s' }}
          >
            {t('hero.tagline')}
            <span className="block mt-2 text-base sm:text-lg text-gray-400">{t('hero.subtagline')}</span>
          </p>

          <div
            className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-6 fade-in"
            style={{ animationDelay: '0.6s' }}
          >
            <Button asChild size="lg" className="group sheen rounded-full glow-brand hover:scale-105">
              <Link to="/studio">
                {t('hero.startCreating')}
                <ArrowRight className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => {
                globalThis.dispatchEvent(new Event(OPEN_ONBOARDING_EVENT));
              }}
              className="rounded-full"
            >
              <Play />
              {t('hero.seeHow')}
            </Button>
          </div>
        </div>
      </div>

      {/* Showcase — an actual in-browser render */}
      <HomeShowcase />

      {/* Create showcase — the studio video-creation flow (pick a template, add a clip, render) */}
      <CreateShowcase />

      {/* Builder showcase — a promo of the template builder (landscape on desktop, portrait on phones) */}
      <BuilderShowcase />

      {/* Mobile section hidden until the iOS/Android app ships on the stores. Re-add <PhoneShowcase />. */}

      {/* Features Section */}
      <FeaturesSection />
    </div>
  );
};
