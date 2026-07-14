import { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Shield } from '@/presentation/components/icons';
import { PlayIcon } from '@/presentation/components/icons/play';
import { useIconHover } from '@/presentation/components/icons/useIconHover';
import { Button } from '@/presentation/components/ui';
import { KineticHeading } from '@/presentation/components/kinetic';
import { useInView } from '@/hooks/useInView';
import { usePointerGlow } from '@/hooks/usePointerGlow';
import { OPEN_ONBOARDING_EVENT } from '@/hooks/useOnboarding';
import { HeroStage } from './hero-stage';
import { HeroViewfinder } from './hero-viewfinder';
import { HeroTimeline } from './hero-timeline';
import { useHeroPlayhead } from './use-hero-playhead';

// The cinematic pacing of the headline: a verb triptych ("Shoot. Cut. Share.") where each word
// lands as its own cut — a much wider stagger than a flowing sentence — then the gradient rule
// grows from the center once the last beat settles.
const BEAT_STAGGER = 0.3;
const wordCount = (text: string): number => text.trim().split(/\s+/).length;

// The homepage hero as LeClap's own program monitor: the film plays behind the glass, framed by
// viewfinder brackets, an on-device tally and a live SMPTE timecode — and the timeline at the foot
// of the frame is a real scrubber that seeks it. Oversized kinetic Oswald type carries the message;
// the brand gradient is reserved for the playhead, the rule and the CTA, per the kinetic-editorial
// rules. Pointer parallax (via --mx/--my) gives the layers depth; every motion settles under
// prefers-reduced-motion.
export const CinematicHero = () => {
  const { t } = useTranslation('home');
  const [reduced] = useState(() => globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const { ref: playRef, hoverProps: playHoverProps } = useIconHover();
  // Toggles as the hero enters/leaves the viewport so playback + the playhead loop stop off-screen.
  const [inViewRef, heroInView] = useInView<HTMLElement>({ once: false, threshold: 0 });
  const { ref: glowRef, glowProps } = usePointerGlow<HTMLElement>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { timecodeRef, scrubRef, onScrub } = useHeroPlayhead(videoRef, { active: heroInView, reduced });

  const setHeroRef = (node: HTMLElement | null) => {
    inViewRef.current = node;
    glowRef.current = node;
  };

  // Settle the parallax planes back to center when the pointer leaves the stage.
  const onPointerLeave = () => {
    glowProps.onPointerLeave();
    glowRef.current?.style.setProperty('--mx', '50%');
    glowRef.current?.style.setProperty('--my', '50%');
  };

  const headline = t('hero.headlineA');
  const ruleDelay = wordCount(headline) * BEAT_STAGGER + 0.35;

  return (
    <section
      ref={setHeroRef}
      onPointerMove={glowProps.onPointerMove}
      onPointerLeave={onPointerLeave}
      className="dark relative flex min-h-[92vh] items-center justify-center overflow-hidden bg-background text-foreground"
    >
      <HeroStage videoRef={videoRef} reduced={reduced} inView={heroInView} />
      {/* The tally already carries the brand via the hero.tally copy ("LeClap · On-device"). */}
      <HeroViewfinder timecodeRef={timecodeRef} />

      <div className="container relative z-10 mx-auto px-6 pb-28 pt-24 text-center sm:pb-32">
        {/* The type follows the pointer a touch (opposite the footage) so the stage reads as depth.
            max-w-6xl keeps the longer localized lines (fr/es/it) on one row each at desktop widths. */}
        <div className="hero-parallax mx-auto max-w-6xl [--parallax:0.018]">
          {/* Brand kicker — the one place gradient type is allowed; the claim keeps the H1. The
              animated pan is the old wordmark's treatment at kicker scale; the global reduced-motion
              reset stills it to a static gradient. The entrance lives on the wrapper because both
              `fade-in` and the pan set the `animation` shorthand — stacked on one node, one wins. */}
          <p className="fade-in mb-5 text-sm font-bold uppercase tracking-[0.35em] -mr-[0.35em]">
            <span className="text-gradient-animated">{t('hero.eyebrow')}</span>
          </p>
          {/* The verb triptych — one line, three beats; each word is a cut landing on the stagger. */}
          <h1 aria-label={headline}>
            <span aria-hidden="true" className="block">
              <KineticHeading as="span" text={headline} level="mega" align="center" uppercase stagger={BEAT_STAGGER} />
            </span>
          </h1>

          {/* The gradient rule — the one brand-gradient stroke of the composition, growing from the
              center out to both edges (default transform origin) once the words have settled. */}
          <motion.span
            aria-hidden="true"
            className="brand-gradient mx-auto mt-6 block h-[3px] w-40 rounded-full"
            initial={reduced ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: reduced ? 0 : 0.6, delay: reduced ? 0 : ruleDelay, ease: [0.16, 1, 0.3, 1] }}
          />

          <p
            className="text-shimmer-radial fade-in mx-auto mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl"
            style={{ animationDelay: '0.9s' }}
          >
            {t('hero.subtagline')}
          </p>
        </div>

        <div
          className="fade-in mt-9 flex flex-col justify-center gap-3 sm:flex-row sm:gap-6"
          style={{ animationDelay: '1.15s' }}
        >
          <Button asChild size="lg" className="group sheen glow-brand rounded-full hover:scale-105">
            <Link to="/studio">
              {t('hero.startCreating')}
              <ArrowRight className="transition-transform group-hover:translate-x-1" />
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

        <p
          className="fade-in mt-7 flex items-center justify-center gap-2 text-sm text-gray-400"
          style={{ animationDelay: '1.35s' }}
        >
          <Shield className="size-4 text-brand-300" aria-hidden="true" />
          {t('hero.privacy')}
        </p>
      </div>

      <HeroTimeline scrubRef={scrubRef} onScrub={onScrub} />
    </section>
  );
};
