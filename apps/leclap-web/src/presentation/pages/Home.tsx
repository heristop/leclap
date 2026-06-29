import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from '@/presentation/components/icons';
import { PlayIcon } from '@/presentation/components/icons/play';
import { useIconHover } from '@/presentation/components/icons/useIconHover';
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
  const { ref: playRef, hoverProps: playHoverProps } = useIconHover();
  // Stop decoding the blurred hero clip once it scrolls off-screen — a full-frame blurred video
  // composited every frame is the page's heaviest scroll cost, and it's invisible past the fold.
  const [heroRef, heroInView] = useInView({ once: false, threshold: 0 });
  const heroVideoRef = useRef<HTMLVideoElement>(null);
  // The visitor's onboarding-compiled video when they've made one, else the bundled default clip.
  const heroSrc = useHeroVideoSrc();
  // Defer mounting the blurred hero clip until the browser is idle after first paint, so its fetch +
  // full-frame decode never competes with the LCP image on load. requestIdleCallback where available,
  // a short timeout as fallback.
  const [stageReady, setStageReady] = useState(false);
  useEffect(() => {
    // Typed as optional because older Safari lacks requestIdleCallback; fall back to a short timeout.
    const requestIdle = globalThis.requestIdleCallback as
      | ((callback: () => void, options?: { timeout: number }) => number)
      | undefined;

    if (requestIdle) {
      const id = requestIdle(
        () => {
          setStageReady(true);
        },
        { timeout: 1500 }
      );

      return () => {
        globalThis.cancelIdleCallback(id);
      };
    }

    const id = globalThis.setTimeout(() => {
      setStageReady(true);
    }, 600);

    return () => {
      globalThis.clearTimeout(id);
    };
  }, []);

  useEffect(() => {
    const el = heroVideoRef.current;

    if (!el || reduced || !stageReady) return;

    if (!heroInView) {
      el.pause();

      return;
    }

    el.play().catch(() => {});
  }, [heroInView, reduced, heroSrc, stageReady]);

  // Hero parallax: the background stage drifts down at a fraction of scroll speed so the layered
  // footage reads as depth behind the copy. Writes a transform off the render path via rAF; the
  // layer is over-sized (inset -8rem) so the drift never reveals an edge. Disabled for reduced motion.
  const stageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = stageRef.current;

        if (!el) {
          return;
        }

        el.style.transform = `translate3d(0, ${(globalThis.scrollY * 0.12).toFixed(1)}px, 0)`;
      });
    };

    if (!reduced) {
      onScroll();
      globalThis.addEventListener('scroll', onScroll, { passive: true });
    }

    return () => {
      globalThis.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [reduced]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background text-foreground overflow-hidden">
      <Seo />
      {/* Hero Section — always-dark "stage": force dark tokens regardless of theme */}
      <div ref={heroRef} className="dark relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Cinematic stage: a base gradient, a dimmed/blurred background clip, the image overlay, then
            a vignette that grounds the footage and keeps the hero copy legible. The whole stage is
            over-sized (-inset-32) and parallax-drifted via stageRef so scroll reveals depth without
            exposing an edge. */}
        <div ref={stageRef} aria-hidden="true" className="absolute -inset-32 z-0 will-change-transform">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 opacity-80" />
          {stageReady && (
            <video
              ref={heroVideoRef}
              src={heroSrc}
              className="pointer-events-none absolute inset-0 h-full w-full scale-105 object-cover opacity-40 blur-[3px]"
              autoPlay={!reduced}
              loop
              muted
              playsInline
              preload="metadata"
              aria-hidden="true"
              tabIndex={-1}
            />
          )}
          {/* Decorative clapperboard texture at 20% opacity under a blend — self-hosted as an optimized
              WebP (68 KB, see public/images) so the LCP element loads from origin with no external
              DNS/TLS round-trip. Credit: Unsplash (see LICENSE › Third-party assets). */}
          <div className="absolute inset-0 bg-[url('/images/hero-texture.webp')] bg-cover bg-center opacity-20 mix-blend-overlay" />
        </div>
        {/* Vignette + edge-fade stay pinned to the hero bounds (not parallaxed) so the hero still
            blends cleanly into the next section regardless of scroll. */}
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
              {...playHoverProps}
            >
              <PlayIcon ref={playRef} size={16} />
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
