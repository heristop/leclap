import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { REPO_URL } from '@/config/site';
import { ArrowRight } from '@/presentation/components/icons';
import { Seo } from '@/presentation/components/Seo';
import { KineticHeading } from '@/presentation/components/kinetic';
import { linkMentions } from './policy-page.logic';

export type PolicySection = { id: string; heading: string; body: string };

type PolicyPageProps = {
  /** Logical route path for <Seo> (canonical + hreflang). */
  path: string;
  seoTitle: string;
  seoDescription: string;
  /** Uppercase eyebrow above the title. */
  badge: string;
  title: string;
  intro: string;
  /** "Last updated …", read as the document's date line. */
  updated: string;
  sections: PolicySection[];
  /** The other policy page, offered where this one ends. */
  sibling: { to: string; label: string };
};

// The addresses the copy spells out as text; linkMentions makes each one clickable.
const MENTIONED_URLS = [REPO_URL];

// A quiet text link, padded to a 44px row so the way on is never a 20px target.
const PAGER_LINK =
  'group inline-flex min-h-11 items-center gap-2 rounded-lg px-2 -mx-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

// Legal notice and privacy policy, laid out as what they are: documents. The whole page follows the visitor's
// theme like the landing and the docs — the masthead included, so the site header over it takes the same
// theme: light prose on a light page reads better than a forced-dark one, and it meets the light footer
// instead of ending on a hard seam. The prose keeps a readable measure and the sections are numbered so they scan
// and can be cited; from `lg` each heading sits in its own column beside its paragraph, so the headings
// read as an index. No scroll reveals: a policy is read, not staged. Pages resolve their own copy and pass
// it in, keeping the typed translation keys with each page and this component presentational.
export const PolicyPage = ({
  path,
  seoTitle,
  seoDescription,
  badge,
  title,
  intro,
  updated,
  sections,
  sibling,
}: PolicyPageProps) => {
  const { t } = useTranslation('common');

  return (
    <article className="bg-background pb-24 text-foreground">
      <Seo title={seoTitle} description={seoDescription} path={path} />

      <header className="relative overflow-hidden border-b border-foreground/10 bg-surface text-foreground">
        {/* The titlebar's slow brand glow, so the masthead reads as lit. Frozen under reduced motion. */}
        <div
          aria-hidden="true"
          className="animate-aurora pointer-events-none absolute -top-24 -left-20 h-64 w-[34rem] rounded-full bg-brand-500/10 blur-[120px]"
        />
        <div className="relative mx-auto max-w-5xl px-4 pt-28 pb-10 sm:px-6 sm:pt-32 sm:pb-12">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-700 dark:text-brand-300">{badge}</p>
          <KineticHeading text={title} as="h1" level="l" className="mt-4 overflow-x-clip" />
          {/* The page's one-sentence answer, so it gets the lead's size rather than a caption's. */}
          <p className="mt-5 max-w-[36rem] text-lg leading-relaxed text-pretty text-foreground/80 sm:text-xl">
            {intro}
          </p>
          <p className="mt-5 text-sm text-muted-foreground">{updated}</p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <ol role="list" className="mt-4 sm:mt-6">
          {sections.map(({ id, heading, body }, index) => (
            <li
              key={id}
              className="grid gap-x-12 gap-y-3 border-b border-divider py-8 sm:py-10 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]"
            >
              <h2
                id={id}
                className="flex items-baseline gap-4 font-display text-xl leading-tight font-semibold tracking-tight text-balance text-foreground sm:text-2xl"
              >
                {/* The number is how the list reads at a glance; the <ol> already tells assistive tech.
                    A fixed width, since Oswald's figures are proportional: every heading starts on one line. */}
                <span
                  aria-hidden="true"
                  className="w-7 shrink-0 font-display text-sm font-bold tracking-[0.2em] text-brand-700 dark:text-brand-300"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                {heading}
              </h2>
              {/* ~70 characters a line: Oswald is condensed, so the measure is narrower in px than usual. */}
              <p className="max-w-[32rem] text-base leading-relaxed text-pretty text-gray-400 sm:text-lg">
                {linkMentions(body, MENTIONED_URLS).map((run, runIndex) =>
                  run.href ? (
                    <a
                      key={runIndex}
                      href={run.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-sm font-medium text-brand-700 underline decoration-brand-500/40 underline-offset-4 transition-colors hover:decoration-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-300"
                    >
                      {run.text}
                    </a>
                  ) : (
                    <span key={runIndex}>{run.text}</span>
                  )
                )}
              </p>
            </li>
          ))}
        </ol>

        {/* Back where the visitor came from, or on to the other policy: the two ways a reader leaves. */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <Link to="/" viewTransition className={PAGER_LINK}>
            <ArrowRight className="size-4 rotate-180 transition-transform group-hover:-translate-x-0.5" />
            {t('nav.home')}
          </Link>
          <Link to={sibling.to} viewTransition className={PAGER_LINK}>
            {sibling.label}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </article>
  );
};
