import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useInView } from '@/hooks/useInView';
import { Button } from '@/presentation/components/ui';

// The clip is an actual LeClap render (1280x720), shipped under public/videos. It plays as a
// muted ambient loop to show the product's output up front; a corner control lets viewers unmute.
// Served VP9/WebM first (smaller) with an H.264/MP4 fallback for older Safari/iOS. The file is
// lazy-mounted only as the frame nears the viewport, so it never costs an above-the-fold visitor.
// Reduced-motion users get a paused player with native controls.
const VIDEO_SRC_WEBM = '/videos/drink-and-coffee.webm';
const VIDEO_SRC_MP4 = '/videos/drink-and-coffee.mp4';
const DEFAULT_VOLUME = 0.7;

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const HomeShowcase = () => {
  const { t } = useTranslation('home');
  const videoRef = useRef<HTMLVideoElement>(null);
  // Two IntersectionObservers on the same frame: one fires early (300px ahead) to start fetching the
  // clip, the other only when the frame truly enters the viewport so the entrance animation is
  // actually seen rather than playing out off-screen.
  const [loadRef, shouldLoad] = useInView<HTMLDivElement>({ rootMargin: '300px' });
  const [revealRef, revealed] = useInView<HTMLDivElement>({ threshold: 0.25 });
  const setFrameRef = useCallback(
    (node: HTMLDivElement | null) => {
      loadRef.current = node;
      revealRef.current = node;
    },
    [loadRef, revealRef]
  );
  const [reduced, setReduced] = useState(prefersReducedMotion);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);

    return () => {
      mq.removeEventListener('change', onChange);
    };
  }, []);

  const toggleMute = () => {
    const el = videoRef.current;

    if (!el) return;

    const next = !muted;
    // Unmuting should land at the slider's level (and never silence), keeping audio and UI in sync.
    if (!next) {
      const level = volume || DEFAULT_VOLUME;
      el.volume = level;
      setVolume(level);
    }
    el.muted = next;
    setMuted(next);
  };

  const changeVolume = (next: number) => {
    const el = videoRef.current;

    if (!el) return;

    el.volume = next;
    el.muted = next === 0;
    setVolume(next);
    setMuted(next === 0);
  };

  return (
    <section className="relative bg-background py-20 sm:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-600 dark:text-brand-300">
            {t('showcase.eyebrow')}
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground text-balance sm:text-4xl">
            {t('showcase.title')}
          </h2>
          <p className="mt-4 leading-relaxed text-gray-400">{t('showcase.subtitle')}</p>
        </div>

        <div className="relative mx-auto mt-12 max-w-4xl">
          {/* Soft brand aura bleeding out from behind the frame; fades in with it. */}
          <div
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute -inset-6 -z-10 rounded-[2.5rem] blur-2xl transition-opacity duration-1000',
              'bg-gradient-to-tr from-brand-500/20 via-secondary-500/10 to-accent-400/20',
              revealed ? 'opacity-100' : 'opacity-0'
            )}
          />
          <div
            ref={setFrameRef}
            className={cn(
              'relative aspect-video overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-foreground/10',
              'transition-all duration-700 ease-[var(--ease-spring)] will-change-[transform,opacity]',
              'motion-reduce:transition-none motion-reduce:!translate-y-0 motion-reduce:!scale-100 motion-reduce:!opacity-100',
              revealed ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-6 scale-[0.97] opacity-0'
            )}
          >
            {/* Shimmer placeholder holds the frame until the video is mounted. */}
            {!shouldLoad && (
              <div
                aria-hidden="true"
                className="absolute inset-0 animate-pulse bg-gradient-to-br from-brand-500/20 via-secondary-500/10 to-accent-400/15"
              />
            )}

            {shouldLoad && (
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                autoPlay={!reduced}
                loop
                muted={muted}
                playsInline
                controls={reduced}
                preload="metadata"
                aria-label={t('showcase.videoAria')}
              >
                <source src={VIDEO_SRC_WEBM} type="video/webm" />
                <source src={VIDEO_SRC_MP4} type="video/mp4" />
              </video>
            )}

            <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white/90 ring-1 ring-white/15 backdrop-blur-sm">
              {t('showcase.badge')}
            </span>

            {/* Sound control — muted by default; the slider reveals on hover/focus. Hidden when the
                native controls are shown for reduced-motion viewers, or before the video mounts. */}
            {shouldLoad && !reduced && (
              <div className="group/vol absolute bottom-3 right-3 flex items-center rounded-full bg-black/55 px-1.5 py-1 ring-1 ring-white/15 backdrop-blur-sm">
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={muted ? t('showcase.unmute') : t('showcase.mute')}
                  className="grid h-8 w-8 place-items-center rounded-full text-white/85 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 [&_svg]:size-4"
                >
                  {muted ? <VolumeX /> : <Volume2 />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  onChange={(event) => {
                    changeVolume(Number(event.target.value));
                  }}
                  aria-label={t('showcase.volume')}
                  className="h-1 w-0 cursor-pointer appearance-none rounded-full bg-white/30 opacity-0 accent-white transition-all duration-200 focus-visible:ml-2 focus-visible:w-20 focus-visible:opacity-100 group-hover/vol:ml-2 group-hover/vol:w-20 group-hover/vol:opacity-100"
                />
              </div>
            )}
          </div>
        </div>

        {/* CTA cluster — remotion.dev-style composition (one filled primary + outlined secondaries),
            built from the app's own Button variants and brand tokens. */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="group rounded-full">
            <Link to="/studio">
              {t('showcase.cta')}
              <ArrowRight className="transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-full">
            <Link to="/templates">{t('showcase.browseTemplates')}</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-full">
            <Link to="/doc">{t('showcase.readDocs')}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};
