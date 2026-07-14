import { useEffect, useRef, useState, type RefObject } from 'react';
import { useHeroVideoSrc } from '@/hooks/useHeroVideoSrc';

interface HeroStageProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  reduced: boolean;
  /** Whether the hero is on screen — playback pauses off-screen so the clip never decodes unseen. */
  inView: boolean;
}

// A faint CRT raster drifting down the whole monitor — the ambient "live video surface" cue.
// The raster layer extends one tile above its clipped wrapper and translates down (compositor-only,
// no per-frame repaint); the global reduced-motion reset stills it to a grille.
const SCANLINE_STYLE = {
  backgroundImage: 'repeating-linear-gradient(to bottom, oklch(1 0 0 / 0.5) 0, oklch(1 0 0 / 0.5) 1px, transparent 1px, transparent 4px)',
  backgroundSize: '100% 4px',
} as const;

// The cinematic backdrop of the hero monitor, layered back-to-front: base gradient → the film
// itself → clapperboard texture → drifting brand aurora → scanline → vignette. The scroll layer is
// over-sized (-inset-28) and drifts at a fraction of scroll speed (rAF transform, off the render
// path); the two `hero-parallax` layers add pointer-reactive depth from the --mx/--my vars the hero
// root writes. The clip mounts on browser idle so its fetch/decode never races first paint.
export function HeroStage({ videoRef, reduced, inView }: HeroStageProps) {
  const heroSrc = useHeroVideoSrc();
  const scrollLayerRef = useRef<HTMLDivElement>(null);
  const [stageReady, setStageReady] = useState(false);

  // Defer mounting the film until the browser is idle after first paint (requestIdleCallback where
  // available, a short timeout as the older-Safari fallback).
  useEffect(() => {
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

  // Pause the film off-screen and resume on return; reduced-motion viewers keep a still frame.
  useEffect(() => {
    const el = videoRef.current;

    if (!el || reduced || !stageReady) return;

    if (!inView) {
      el.pause();

      return;
    }

    el.play().catch(() => {});
  }, [inView, reduced, heroSrc, stageReady, videoRef]);

  // Scroll parallax: the stage drifts down at a fraction of scroll speed so the footage reads as
  // depth behind the copy. Transform written via rAF; the layer is over-sized so no edge shows.
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = scrollLayerRef.current;

        if (!el) return;

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
    <>
      <div ref={scrollLayerRef} aria-hidden="true" className="absolute -inset-28 z-0 will-change-transform">
        {/* The film layer counter-moves the pointer slightly — footage behind the glass. */}
        <div className="hero-parallax absolute inset-0 [--parallax:-0.05]">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 opacity-80" />
          {stageReady && (
            <video
              ref={videoRef}
              src={heroSrc}
              className="pointer-events-none absolute inset-0 h-full w-full scale-105 object-cover opacity-50"
              autoPlay={!reduced}
              loop
              muted
              playsInline
              preload="metadata"
              aria-hidden="true"
              tabIndex={-1}
            />
          )}
          {/* Clapperboard texture — self-hosted WebP, the home route's preloaded LCP image. */}
          <div className="absolute inset-0 bg-[url('/images/hero-texture.webp')] bg-cover bg-center opacity-20 mix-blend-overlay" />
        </div>

        {/* Brand aurora — two slow, blurred lavender/pink glows on a deeper parallax plane. */}
        <div className="hero-parallax absolute inset-0 [--parallax:-0.09]">
          <div className="animate-aurora absolute left-[6%] top-[10%] h-[46%] w-[44%] rounded-full bg-brand-500/25 blur-[110px]" />
          <div className="animate-aurora absolute bottom-[8%] right-[4%] h-[42%] w-[40%] rounded-full bg-secondary-400/20 blur-[110px] [animation-delay:-9s]" />
        </div>
      </div>

      {/* Pinned overlays — scanline, vignette and the fade into the next section stay fixed to the
          hero bounds (not parallaxed) so the frame stays grounded regardless of scroll. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-[0.13]">
        <div className="animate-scanline absolute inset-x-0 -top-1 bottom-0" style={SCANLINE_STYLE} />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,transparent_15%,rgba(8,8,14,0.74))]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-t from-background via-transparent to-background/40"
      />
    </>
  );
}
