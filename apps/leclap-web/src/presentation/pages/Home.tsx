import { useState } from 'react';
import { ArrowRight, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FeaturesSection } from '@/presentation/components/FeaturesSection';
import { HomeShowcase } from '@/presentation/components/HomeShowcase';
import { Seo } from '@/presentation/components/Seo';
import { Button } from '@/presentation/components/ui';
import { OPEN_ONBOARDING_EVENT } from '@/hooks/useOnboarding';

export const Home = () => {
  const { t } = useTranslation('home');
  // POC: a dimmed background clip behind the hero. Paused for reduced-motion viewers.
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background text-foreground overflow-hidden">
      <Seo />
      {/* Hero Section — always-dark "stage": force dark tokens regardless of theme */}
      <div className="dark relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Cinematic stage: a base gradient, a dimmed/blurred background clip, the image overlay, then
            a vignette that grounds the footage and keeps the hero copy legible. */}
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 opacity-80" />
        <video
          src="/videos/clapperboard.mp4"
          className="pointer-events-none absolute inset-0 z-0 h-full w-full scale-105 object-cover opacity-40 blur-[3px]"
          autoPlay={!reduced}
          loop
          muted
          playsInline
          preload="metadata"
          aria-hidden="true"
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
            className="text-7xl md:text-9xl font-bold mb-6 tracking-tighter fade-in"
            style={{ animationDelay: '0.2s' }}
          >
            <span className="text-gradient-animated">{t('brand', { ns: 'common' })}</span>
          </h1>

          <p
            className="text-2xl md:text-3xl text-gray-300 mb-12 max-w-3xl mx-auto font-light leading-relaxed fade-in"
            style={{ animationDelay: '0.4s' }}
          >
            {t('hero.tagline')}
            <span className="block mt-2 text-lg text-gray-400">{t('hero.subtagline')}</span>
          </p>

          <div className="flex flex-col md:flex-row justify-center gap-6 fade-in" style={{ animationDelay: '0.6s' }}>
            <Button asChild size="lg" className="group rounded-full glow-brand hover:scale-105">
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
                window.dispatchEvent(new Event(OPEN_ONBOARDING_EVENT));
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

      {/* Features Section */}
      <FeaturesSection />
    </div>
  );
};
