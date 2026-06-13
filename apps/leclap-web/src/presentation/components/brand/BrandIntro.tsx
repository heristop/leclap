import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatedLogo } from '@/presentation/components/brand/AnimatedLogo';
import { cn } from '@/lib/utils';

// Once-per-session brand sting: the LeClap clapperboard claps shut, then the wordmark lands, then it
// fades to reveal the app. Sits above everything (incl. onboarding) so a first visit reads as
// "logo intro → onboarding". Respects reduced-motion (static mark, quick dismiss).
const SEEN_KEY = 'leclap.brandIntro.seen';
const PLAY_MS = 1900;
const REDUCED_MS = 700;
const FADE_MS = 400;

type Phase = 'hidden' | 'playing' | 'leaving';

const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

export const BrandIntro = () => {
  const [phase, setPhase] = useState<Phase>('hidden');

  useEffect(() => {
    if (typeof window === 'undefined' || sessionStorage.getItem(SEEN_KEY)) return () => {};

    sessionStorage.setItem(SEEN_KEY, '1');
    const hold = prefersReducedMotion() ? REDUCED_MS : PLAY_MS;

    setPhase('playing');
    const leave = setTimeout(() => {
      setPhase('leaving');
    }, hold);
    const done = setTimeout(() => {
      setPhase('hidden');
    }, hold + FADE_MS);

    return () => {
      clearTimeout(leave);
      clearTimeout(done);
    };
  }, []);

  if (phase === 'hidden') return null;

  const reduced = prefersReducedMotion();

  return createPortal(
    <div
      role="presentation"
      onClick={() => {
        setPhase('leaving');
      }}
      className={cn(
        'fixed inset-0 z-[70] grid place-items-center bg-[#0b0b0f] transition-opacity duration-[400ms] motion-reduce:transition-none',
        phase === 'leaving' ? 'opacity-0' : 'opacity-100'
      )}
    >
      <div className="flex flex-col items-center gap-6">
        <AnimatedLogo size={156} play={!reduced} />
        <span
          className={cn('font-display text-5xl font-bold tracking-tight text-white', !reduced && 'lc-wordmark-rise')}
        >
          LeClap
        </span>
      </div>
      <button
        type="button"
        onClick={() => {
          setPhase('leaving');
        }}
        className="absolute bottom-8 right-8 text-sm text-white/50 transition-colors hover:text-white/90"
      >
        Skip
      </button>
    </div>,
    document.body
  );
};
