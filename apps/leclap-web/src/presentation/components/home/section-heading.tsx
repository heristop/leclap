import { cn } from '@/lib/utils';
import { Reveal } from '@/presentation/components/ui';

/**
 * The landing's section header: an eyebrow, one headline and one supporting line, centred, fading up whole
 * on the out-expo curve (no overshoot on text). Every section after the hero opens with it, so the page
 * keeps one type ramp from the film down to the features. The eyebrow's trailing tracking is pulled back
 * so the centred label sits on the axis, and the supporting line is balanced rather than left with a widow.
 * The eyebrow is the one lavender line: brand-700 on the light page, brand-300 on the dark one, each well
 * over 4.5:1 at its small size. The headline's tight 0.95 leading is the English cut: Oswald's accented
 * capitals rise to 1.075em against a 0.81em cap height, so in the other languages (É, À, Ä, Ñ…) a wrapped
 * line's accents would strike the letters above; there it opens to 1.16.
 */
export const SectionHeading = ({
  eyebrow,
  title,
  subtitle,
  className,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  className?: string;
}) => (
  <Reveal className={cn('mx-auto max-w-4xl px-4 text-center ease-[var(--ease-out-expo)] sm:px-6', className)}>
    <p className="-mr-[0.3em] text-xs font-semibold uppercase tracking-[0.3em] text-brand-700 dark:text-brand-300">
      {eyebrow}
    </p>
    <h2 className="mt-4 font-display text-[length:var(--text-display-section)] font-bold uppercase leading-[0.95] tracking-[-0.015em] text-balance [&:not(:lang(en))]:leading-[1.16]">
      {title}
    </h2>
    <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-gray-400 text-balance">{subtitle}</p>
  </Reveal>
);
