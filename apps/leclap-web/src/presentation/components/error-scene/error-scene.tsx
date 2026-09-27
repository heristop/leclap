import { Fragment, useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ClappyReaction, type ClappyReactionName } from '@/presentation/components/clappy';
import { withPath } from './not-found.logic';

/** The slate light: brand for the visitor's side of things, red only for a crash, which is ours. */
export type SceneTone = 'brand' | 'error' | 'success' | 'muted';

const TONE_LIGHT: Record<SceneTone, string> = {
  brand: 'bg-brand-500',
  error: 'bg-[var(--color-error)]',
  success: 'bg-success',
  muted: 'bg-muted-foreground/60',
};

const CHIP =
  'absolute inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-background/70 px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground backdrop-blur-sm';

// One corner registration bracket, as on the home hero's viewfinder.
const Bracket = ({ className }: { className: string }) => (
  <span className={cn('absolute size-7 border-brand-300/70 sm:size-9', className)} />
);

/**
 * The camera's view of Clappy: corner brackets, a slate naming the take on the left, a timecode on the
 * right, a soft stage light behind him and a shadow under his feet. Decorative, all of it.
 */
const Viewfinder = ({
  slate,
  tone,
  timecode,
  children,
}: {
  slate: string;
  tone: SceneTone;
  timecode?: string;
  children: ReactNode;
}) => (
  <div aria-hidden="true" className="fade-in relative mx-auto h-56 w-full max-w-sm sm:h-60">
    <div className="absolute inset-x-12 bottom-6 top-10 rounded-full bg-brand-500/15 blur-3xl" />
    <Bracket className="left-0 top-0 rounded-tl-xl border-l-2 border-t-2" />
    <Bracket className="right-0 top-0 rounded-tr-xl border-r-2 border-t-2" />
    <Bracket className="bottom-0 left-0 rounded-bl-xl border-b-2 border-l-2" />
    <Bracket className="bottom-0 right-0 rounded-br-xl border-b-2 border-r-2" />
    <span className={cn(CHIP, 'left-3.5 top-3.5')}>
      <span className={cn('size-1.5 rounded-full', TONE_LIGHT[tone])} />
      {slate}
    </span>
    {timecode !== undefined && (
      <span className={cn(CHIP, 'right-3.5 top-3.5 font-mono tracking-[0.08em]')}>
        <span className="text-muted-foreground/60">TC</span>
        <span className="tabular-nums">{timecode}</span>
      </span>
    )}
    <div className="absolute inset-x-0 bottom-5 flex justify-center">
      <span className="absolute -bottom-1 h-3 w-24 rounded-[50%] bg-foreground/15 blur-md" />
      {children}
    </div>
  </div>
);

export interface ErrorSceneProps {
  reaction: ClappyReactionName;
  /** The viewfinder's slate: a word or two naming the take. */
  slate: string;
  tone: SceneTone;
  /** The viewfinder's timecode, when there is a status to spell. */
  timecode?: string;
  /** The plain status above the heading: the code, and what it means. */
  eyebrow: string;
  title: string;
  children: ReactNode;
}

/**
 * The error pages' one scene: Clappy reacting in a camera viewfinder, then the status, the heading and the
 * ways out the page offers. The 404, the bad request and the crash share it, so they read as one family.
 * Entrances are staggered ~70 ms apart — the scene, then what happened, then the way out — and the global
 * reduced-motion reset lands them settled. The heading takes focus on arrival, so a screen reader announces
 * the page a client-side navigation just swapped in.
 */
export const ErrorScene = ({ reaction, slate, tone, timecode, eyebrow, title, children }: ErrorSceneProps) => {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-xl text-center">
      <Viewfinder slate={slate} tone={tone} timecode={timecode}>
        <ClappyReaction reaction={reaction} size={164} />
      </Viewfinder>
      <p
        className="animate-rise-in mt-8 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
        style={{ animationDelay: '140ms' }}
      >
        {eyebrow}
      </p>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="animate-rise-in mt-3 text-balance font-display text-4xl font-bold leading-[1.08] tracking-tight text-foreground outline-none sm:text-5xl"
        style={{ animationDelay: '210ms' }}
      >
        {title}
      </h1>
      <div className="animate-rise-in mt-4" style={{ animationDelay: '280ms' }}>
        {children}
      </div>
    </div>
  );
};

/**
 * The address, monospaced. It moves to the next line whole, and only breaks when it is longer than a line,
 * so a long one can't push the page sideways; a broken chip keeps its padding on both halves.
 */
export const PathChip = ({ children }: { children: ReactNode }) => (
  <code className="box-decoration-clone rounded-md bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[0.88em] break-words text-foreground">
    {children}
  </code>
);

/** A translated sentence with the address set in its <path/> slot (not-found.logic.ts: withPath). */
export const PathSentence = ({ sentence, path }: { sentence: string; path: string }) => (
  <>
    {withPath(sentence, path).map((part, index) => {
      const key = `${index}:${part.text}`;

      return part.isPath ? <PathChip key={key}>{part.text}</PathChip> : <Fragment key={key}>{part.text}</Fragment>;
    })}
  </>
);

/** The body copy under the heading. */
export const SceneMessage = ({ children }: { children: ReactNode }) => (
  <p className="mx-auto max-w-md text-balance text-base text-muted-foreground sm:text-lg">{children}</p>
);

/** The scene's ways out: stacked full width on phones, side by side from sm up. */
export const SceneActions = ({ children }: { children: ReactNode }) => (
  <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">{children}</div>
);
