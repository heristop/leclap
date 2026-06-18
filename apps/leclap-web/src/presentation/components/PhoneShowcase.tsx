import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Camera, Sparkles, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useInView } from '@/hooks/useInView';
import { Button, Reveal } from '@/presentation/components/ui';

// A real screen-recording of the LeClap Android app (604x1080), shipped under public/videos. It plays
// as a muted ambient loop inside a phone frame to land the on-device mobile story next to the web
// showcase. Served VP9/WebM first (1 MB) with the original H.264/MP4 as the older-Safari/iOS fallback,
// and lazy-mounted only as the frame nears the viewport. Reduced-motion users get a paused player with
// native controls.
const VIDEO_SRC_WEBM = '/videos/leclap-android-demo.webm';
const VIDEO_SRC_MP4 = '/videos/leclap-android-demo.mp4';

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const BULLETS = [
  { key: 'capture', Icon: Camera },
  { key: 'effects', Icon: Sparkles },
  { key: 'offline', Icon: WifiOff },
] as const;

export const PhoneShowcase = () => {
  const { t } = useTranslation('home');
  const videoRef = useRef<HTMLVideoElement>(null);
  // Two IntersectionObservers on the same frame: one fires early (300px ahead) to start fetching the
  // clip, the other only once the frame is well into the viewport (a third of it visible, and not until
  // it has cleared the bottom margin) so the entrance plays where the viewer is actually looking.
  const [loadRef, shouldLoad] = useInView({ rootMargin: '300px' });
  const [revealRef, revealed] = useInView({ threshold: 0.35, rootMargin: '0px 0px -12% 0px' });
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

  return (
    <section className="relative overflow-hidden bg-background py-14 sm:py-20 lg:py-28">
      <div className="mx-auto w-full max-w-6xl px-4">
        <div className="grid items-center gap-10 sm:gap-12 lg:grid-cols-2 lg:gap-14">
          {/* Copy — left, intentionally not centered, to break the showcase's symmetry. */}
          <div className="order-2 lg:order-1">
            <Reveal from="up" threshold={0.4} rootMargin="0px 0px -12% 0px">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-600 dark:text-brand-300">
                {t('phoneShowcase.eyebrow')}
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground text-balance sm:text-4xl">
                {t('phoneShowcase.title')}
              </h2>
              <p className="mt-4 max-w-prose leading-relaxed text-gray-400">{t('phoneShowcase.subtitle')}</p>
            </Reveal>

            <Reveal from="up" delay={120} threshold={0.4} rootMargin="0px 0px -12% 0px" className="mt-8">
              <ul className="space-y-4">
                {BULLETS.map(({ key, Icon }) => (
                  <li key={key} className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-500 ring-1 ring-brand-500/20 [&_svg]:size-[1.05rem]">
                      <Icon aria-hidden="true" />
                    </span>
                    <span className="leading-relaxed text-gray-300">{t(`phoneShowcase.bullets.${key}`)}</span>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal
              from="up"
              delay={240}
              threshold={0.4}
              rootMargin="0px 0px -12% 0px"
              className="mt-10 flex flex-wrap items-center gap-3"
            >
              <Button asChild size="lg" className="group rounded-full">
                <Link to="/studio">
                  {t('phoneShowcase.cta')}
                  <ArrowRight className="transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full">
                <Link to="/doc">{t('phoneShowcase.secondaryCta')}</Link>
              </Button>
            </Reveal>
          </div>

          {/* Phone — right. The recording is a phone screen capture, so it sits in a device bezel. */}
          <div className="relative order-1 lg:order-2">
            {/* Soft brand aura bleeding out from behind the phone; fades in with it. */}
            <div
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl transition-opacity duration-1000',
                'bg-gradient-to-tr from-brand-500/25 via-secondary-500/12 to-accent-400/20',
                revealed ? 'opacity-100' : 'opacity-0'
              )}
            />

            <div
              ref={setFrameRef}
              className={cn(
                'relative mx-auto w-full max-w-[290px] rounded-[2.8rem] bg-gradient-to-b from-neutral-700 via-neutral-900 to-neutral-950 p-[11px]',
                'shadow-[0_34px_60px_-22px_oklch(0_0_0_/_0.6),0_10px_22px_-12px_oklch(0_0_0_/_0.45)] ring-1 ring-black/60',
                'transition-all duration-700 ease-[var(--ease-spring)]',
                'motion-reduce:transition-none motion-reduce:!translate-y-0 motion-reduce:!scale-100 motion-reduce:!opacity-100',
                revealed
                  ? 'translate-y-0 scale-100 opacity-100'
                  : 'translate-y-8 scale-[0.97] opacity-0 will-change-[transform,opacity]'
              )}
            >
              {/* Hairline inner highlight along the bezel edge. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-[2.8rem] ring-1 ring-inset ring-white/10"
              />
              {/* Machined side buttons — volume pair on the left, power on the right. */}
              <span
                aria-hidden="true"
                className="absolute -left-px top-[5.4rem] h-7 w-[2px] rounded-l bg-neutral-700"
              />
              <span
                aria-hidden="true"
                className="absolute -left-px top-[7.6rem] h-11 w-[2px] rounded-l bg-neutral-700"
              />
              <span
                aria-hidden="true"
                className="absolute -right-px top-[7rem] h-14 w-[2px] rounded-r bg-neutral-700"
              />

              <div className="relative aspect-[604/1080] overflow-hidden rounded-[2.2rem] bg-black">
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
                    muted
                    playsInline
                    controls={reduced}
                    preload="metadata"
                    aria-label={t('phoneShowcase.videoAria')}
                  >
                    <source src={VIDEO_SRC_WEBM} type="video/webm" />
                    <source src={VIDEO_SRC_MP4} type="video/mp4" />
                  </video>
                )}

                {/* Highlight sweep across the glass. Ambient only, so hidden for reduced-motion. */}
                {shouldLoad && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 animate-phone-sheen mix-blend-screen motion-reduce:hidden"
                    style={{
                      background:
                        'linear-gradient(115deg, transparent 38%, oklch(0.71 0.16 293 / 0.1) 46%, oklch(1 0 0 / 0.22) 50%, transparent 60%)',
                      backgroundSize: '250% 250%',
                    }}
                  />
                )}

                {/* Hairline screen edge so the display meets the bezel cleanly. */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-[2.2rem] ring-1 ring-inset ring-white/10"
                />

                <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white/90 ring-1 ring-white/15 backdrop-blur-sm">
                  {t('phoneShowcase.badge')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
