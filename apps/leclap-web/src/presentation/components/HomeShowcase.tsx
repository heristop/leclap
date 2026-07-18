import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { ArrowRight, Volume2, VolumeX } from '@/presentation/components/icons';
import { cn } from '@/lib/utils';
import { useInView } from '@/hooks/useInView';
import { useScrollReveal } from '@/hooks/use-scroll-reveal';
import { Button } from '@/presentation/components/ui';
import { KineticHeading } from '@/presentation/components/kinetic';
import { perforationMaskStyle, perforationTileStyle } from '@/lib/film-strip';

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
  const [loadRef, shouldLoad] = useInView({ rootMargin: '300px' });
  const [revealRef, revealed] = useInView({ threshold: 0.1 });
  // Toggles as the frame enters/leaves the viewport (not once) so playback can pause off-screen.
  const [playRef, playInView] = useInView({ once: false, threshold: 0 });
  const setFrameRef = useCallback(
    (node: HTMLDivElement | null) => {
      loadRef.current = node;
      revealRef.current = node;
      playRef.current = node;
    },
    [loadRef, revealRef, playRef]
  );
  const [reduced, setReduced] = useState(prefersReducedMotion);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  // Scroll-scrubbed parallax reveal for the frame — same motion language as the hero ghost panels.
  const revealScopeRef = useRef<HTMLDivElement>(null);
  const reveal = useScrollReveal(revealScopeRef);
  // Store the element AND set `muted` as an attribute the instant it mounts, before the browser
  // evaluates autoplay eligibility — otherwise some browsers refuse the scroll-triggered play().
  const setVideoEl = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;

    if (node) {
      node.muted = true;
      node.setAttribute('muted', '');
    }
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => {
      setReduced(mq.matches);
    };
    mq.addEventListener('change', onChange);

    return () => {
      mq.removeEventListener('change', onChange);
    };
  }, []);

  // Pause the clip while it's off-screen (and resume on return) so it never decodes behind the fold.
  useEffect(() => {
    const el = videoRef.current;

    if (!el || reduced) return;

    if (!playInView) {
      el.pause();

      return;
    }

    el.play().catch(() => {});
  }, [playInView, reduced, shouldLoad]);

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
    <section className="relative bg-background pb-10 pt-4 sm:pb-16 sm:pt-8 lg:pb-28 lg:pt-14">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-600 dark:text-brand-300">
            {t('showcase.eyebrow')}
          </p>
          <KineticHeading
            text={t('showcase.title')}
            as="h2"
            level="m"
            align="center"
            revealOnView
            className="mt-3 text-balance"
          />
          <p className="mt-4 leading-relaxed text-gray-400">{t('showcase.subtitle')}</p>
        </div>

        <div ref={revealScopeRef} className="relative mx-auto mt-8 max-w-4xl [perspective:1400px] sm:mt-12">
          {/* Projector glow — a soft brand aura behind the frame that fades in with it, then slowly
              drifts/breathes (animate-aurora) so the frame reads as lit by a projector. Frozen under
              the global reduced-motion reset. */}
          <div
            aria-hidden="true"
            className={cn(
              'animate-aurora pointer-events-none absolute -inset-6 -z-10 rounded-[2.5rem] blur-2xl transition-opacity duration-1000',
              'bg-gradient-to-tr from-brand-500/20 via-secondary-500/10 to-accent-400/20',
              revealed ? 'opacity-100' : 'opacity-0'
            )}
          />
          <motion.div
            ref={setFrameRef}
            className="relative rounded-xl shadow-xl ring-1 ring-foreground/10 sm:rounded-2xl sm:shadow-2xl"
            // Scroll-scrubbed rise + fade + tilt + parallax; skipped under reduced motion so the frame
            // simply sits in place with native controls.
            style={
              reduced
                ? undefined
                : { opacity: reveal.opacity, y: reveal.y, rotateX: reveal.rotateX, scale: reveal.scale }
            }
          >
            {/* The rounded clip lives on this untransformed wrapper: a 3D-transformed element cannot
                clip its composited children to a border-radius. Chrome also lets composited children
                (the <video>) escape a rounded overflow clip inside a 3D rendering context, so the
                corners are enforced with clip-path, which the compositor always honors. */}
            <div className="relative aspect-video overflow-hidden rounded-[inherit] bg-black [clip-path:inset(0_round_0.75rem)] sm:[clip-path:inset(0_round_1rem)]">
              {/* Shimmer placeholder holds the frame until the video is mounted. */}
              {!shouldLoad && (
                <div
                  aria-hidden="true"
                  className="absolute inset-0 animate-pulse bg-gradient-to-br from-brand-500/20 via-secondary-500/10 to-accent-400/15"
                />
              )}

              {shouldLoad && (
                <video
                  ref={setVideoEl}
                  className="h-full w-full object-cover"
                  autoPlay={!reduced}
                  loop
                  muted={muted}
                  playsInline
                  controls={reduced}
                  preload="auto"
                  aria-label={t('showcase.videoAria')}
                  onLoadedData={(event) => {
                    if (reduced || !playInView) return;
                    event.currentTarget.play().catch(() => {});
                  }}
                >
                  <source src={VIDEO_SRC_WEBM} type="video/webm" />
                  <source src={VIDEO_SRC_MP4} type="video/mp4" />
                </video>
              )}

              <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white/90 ring-1 ring-white/15 backdrop-blur-sm">
                {t('showcase.badge')}
              </span>

              {/* Film-cell edges: sprocket holes drift along the top and bottom of the frame (the footer
                motif), each on a slim dark gradient so the holes stay legible over bright video. The
                drifting span is one tile wider than the strip and translates (compositor-only), so a
                static masked wrapper clips it and keeps the edge fade in place. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-3 bg-gradient-to-b from-black/55 to-transparent"
              >
                <span className="absolute inset-0 overflow-hidden" style={perforationMaskStyle}>
                  <span
                    className="animate-film-drift absolute inset-y-0 -left-7 right-0"
                    style={{ ...perforationTileStyle, backgroundPosition: 'left top' }}
                  />
                </span>
              </span>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-3 bg-gradient-to-t from-black/55 to-transparent"
              >
                <span className="absolute inset-0 overflow-hidden" style={perforationMaskStyle}>
                  <span
                    className="animate-film-drift absolute inset-y-0 -left-7 right-0"
                    style={{ ...perforationTileStyle, backgroundPosition: 'left bottom' }}
                  />
                </span>
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
          </motion.div>
        </div>

        {/* CTA cluster: one filled primary + outlined secondaries, from the app's Button variants. */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:mt-10">
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
