import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from '@/presentation/components/icons';
import { cn } from '@/lib/utils';
import { useInView } from '@/hooks/useInView';
import { Button } from '@/presentation/components/ui';

// A muted ambient loop of a Remotion promo (landscape 16:9 + portrait 9:16 cuts), shown on the home page.
// The orientation is responsive — landscape on desktop, portrait on phones — and only the matching cut is
// mounted, so a single clip ever decodes. Served VP9/WebM first (smaller) with an H.264/MP4 fallback;
// lazy-mounted near the viewport and paused off-screen. Reduced-motion viewers get a paused native player.
// Used by BuilderShowcase.
export interface PromoSources {
  webm: string;
  mp4: string;
}

interface ResponsivePromoShowcaseProps {
  landscape: PromoSources;
  portrait: PromoSources;
  eyebrow: string;
  title: string;
  subtitle: string;
  badge: string;
  videoAria: string;
  cta: string;
  ctaTo: string;
  // Which side the video sits on at desktop widths — alternated between sections for visual rhythm.
  mediaSide: 'left' | 'right';
}

const WIDE_QUERY = '(min-width: 768px)';
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Scroll-in reveal: slide up + fade in once the grid enters view (each column gets its own hidden
// offset so they can be staggered). Kept module-level so its branch stays out of the component's
// cyclomatic budget.
const REVEAL_BASE =
  'transition-all duration-700 ease-[var(--ease-spring)] motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none';
const revealClasses = (revealed: boolean, hiddenOffset: string): string =>
  revealed ? `${REVEAL_BASE} translate-y-0 opacity-100` : `${REVEAL_BASE} opacity-0 ${hiddenOffset}`;

export const ResponsivePromoShowcase = ({
  landscape,
  portrait,
  eyebrow,
  title,
  subtitle,
  badge,
  videoAria,
  cta,
  ctaTo,
  mediaSide,
}: ResponsivePromoShowcaseProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  // A callback ref that stores the element AND sets `muted` as an attribute the instant it mounts —
  // before the browser evaluates autoplay eligibility. Setting it only in an effect (after mount) is
  // too late for some browsers, which then refuse the scroll-triggered play().
  const setVideoEl = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;

    if (node) {
      node.muted = true;
      node.setAttribute('muted', '');
    }
  }, []);
  // Fetch the clip a little before it enters view, reveal the section once it truly does, and toggle
  // play/pause as it enters/leaves so it never decodes off-screen.
  const [loadRef, shouldLoad] = useInView({ rootMargin: '300px' });
  // The reveal sits on the grid so copy + video animate in together. Low threshold + the default early
  // rootMargin so it fires reliably as the section scrolls up (a strict threshold could leave the media
  // column stuck at opacity-0 = an invisible "dead" video).
  const [revealRef, revealed] = useInView({ threshold: 0.08 });
  const [playRef, playInView] = useInView({ once: false, threshold: 0 });
  // The media frame carries the lazy-load + play observers.
  const setMediaRef = useCallback(
    (node: HTMLDivElement | null) => {
      loadRef.current = node;
      playRef.current = node;
    },
    [loadRef, playRef]
  );
  const [reduced, setReduced] = useState(prefersReducedMotion);
  const [wide, setWide] = useState(() => window.matchMedia(WIDE_QUERY).matches);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const width = window.matchMedia(WIDE_QUERY);
    const onMotion = () => {
      setReduced(motion.matches);
    };
    const onWidth = () => {
      setWide(width.matches);
    };
    motion.addEventListener('change', onMotion);
    width.addEventListener('change', onWidth);

    return () => {
      motion.removeEventListener('change', onMotion);
      width.removeEventListener('change', onWidth);
    };
  }, []);

  // Pause off-screen (and resume on return); re-run when the mounted orientation swaps. Mobile (esp. iOS)
  // only honors inline muted-autoplay when `muted` is set on the element itself, not just via the React
  // prop — so force it before calling play(), otherwise play() rejects and nothing starts.
  useEffect(() => {
    const el = videoRef.current;

    if (!el || reduced) return;
    el.muted = true;
    el.setAttribute('muted', '');

    if (!playInView) {
      el.pause();

      return;
    }

    el.play().catch(() => {});
  }, [playInView, reduced, shouldLoad, wide]);

  // No `key` on the <video> (it would remount the element on orientation change and drop playback).
  // Instead, when the orientation actually flips, reload so the swapped <source> takes effect, then
  // resume if it's on screen. Guarded by prevWide so playInView/reduced changes don't trigger a reload.
  const prevWide = useRef(wide);
  useEffect(() => {
    if (prevWide.current === wide) return;
    prevWide.current = wide;
    const el = videoRef.current;

    if (!el || reduced) return;
    el.load();
    el.muted = true;

    if (playInView) el.play().catch(() => {});
  }, [wide, playInView, reduced]);

  const src = wide ? landscape : portrait;

  return (
    <section className="relative overflow-hidden bg-background py-14 sm:py-18 lg:py-24">
      <div className="container mx-auto px-4 sm:px-6">
        <div
          ref={revealRef}
          className="mx-auto grid max-w-6xl items-center gap-x-10 gap-y-8 lg:grid-cols-2 lg:gap-x-16"
        >
          {/* Copy — centered on mobile, aligned to the side opposite the video on desktop. */}
          <div
            className={cn(
              'mx-auto max-w-xl text-center lg:mx-0 lg:text-left',
              revealClasses(revealed, 'translate-y-4'),
              mediaSide === 'left' ? 'lg:order-2' : 'lg:order-1'
            )}
          >
            <p className="inline-flex items-center gap-2.5 text-xs font-semibold tracking-[0.2em] text-brand-600 uppercase dark:text-brand-300">
              <span
                aria-hidden="true"
                className="h-px w-7 rounded-full bg-linear-to-r from-brand-500 to-secondary-500"
              />
              {eyebrow}
            </p>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-balance text-foreground sm:text-4xl lg:text-[2.6rem] lg:leading-[1.12]">
              {title}
            </h2>
            <p className="mt-3.5 text-pretty text-gray-400 sm:text-lg">{subtitle}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3 lg:justify-start">
              <Button asChild size="lg" className="group rounded-full">
                <Link to={ctaTo}>
                  {cta}
                  <ArrowRight className="transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Video frame — capped so it never spans edge-to-edge; trails the copy on reveal. */}
          <div
            className={cn(
              'relative [transition-delay:120ms]',
              revealClasses(revealed, 'translate-y-6'),
              mediaSide === 'left' ? 'lg:order-1' : 'lg:order-2'
            )}
          >
            <div
              className={cn(
                'relative mx-auto',
                wide ? 'w-full max-w-2xl lg:max-w-none' : 'max-w-[17rem] sm:max-w-[19rem]'
              )}
            >
              {/* Soft brand aura bleeding out from behind the frame; fades in with it. */}
              <div
                aria-hidden="true"
                className={cn(
                  'pointer-events-none absolute -inset-5 -z-10 rounded-[2.5rem] bg-linear-to-tr from-brand-500/20 via-secondary-500/10 to-accent-400/20 opacity-0 blur-2xl transition-opacity duration-1000',
                  revealed && 'opacity-100'
                )}
              />
              <div
                ref={setMediaRef}
                className={cn(
                  'group relative overflow-hidden rounded-2xl bg-black shadow-xl ring-1 ring-foreground/10 transition duration-500 sm:shadow-2xl hover:-translate-y-1 hover:ring-foreground/25 motion-reduce:hover:translate-y-0',
                  wide ? 'aspect-video' : 'aspect-[9/16]'
                )}
              >
                {/* Shimmer placeholder holds the frame until the video is mounted. */}
                {!shouldLoad && (
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 animate-pulse bg-linear-to-br from-brand-500/20 via-secondary-500/10 to-accent-400/15"
                  />
                )}

                {shouldLoad && (
                  <video
                    ref={setVideoEl}
                    className="h-full w-full object-cover"
                    autoPlay={!reduced}
                    loop
                    muted
                    playsInline
                    controls={reduced}
                    // Prebuffer once the frame is near the viewport (it's only mounted then), so the
                    // scroll-triggered play() starts instantly instead of stalling on a metadata clip.
                    preload="auto"
                    aria-label={videoAria}
                    onCanPlay={(event) => {
                      if (reduced || !playInView) return;
                      event.currentTarget.muted = true;
                      event.currentTarget.play().catch(() => {});
                    }}
                    onLoadedData={(event) => {
                      if (reduced || !playInView) return;
                      event.currentTarget.play().catch(() => {});
                    }}
                  >
                    <source src={src.webm} type="video/webm" />
                    <source src={src.mp4} type="video/mp4" />
                  </video>
                )}

                <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white/90 ring-1 ring-white/15 backdrop-blur-sm">
                  {badge}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
