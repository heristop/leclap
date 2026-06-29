import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, type LucideIcon } from '@/presentation/components/icons';
import { Seo } from '@/presentation/components/Seo';
import { StudioSurface } from '@/presentation/components/StudioSurface';
import { Card, Reveal } from '@/presentation/components/ui';

export type PolicySection = { Icon: LucideIcon; heading: string; body: string };

type PolicyPageProps = {
  /** Logical route path for <Seo> (canonical + hreflang). */
  path: string;
  seoTitle: string;
  seoDescription: string;
  /** Uppercase eyebrow above the title (StudioSurface kicker). */
  badge: string;
  title: string;
  intro: string;
  /** "Last updated …" shown as a quiet chip above the sections. */
  updated: string;
  sections: PolicySection[];
};

// Legal / privacy pages rendered on the studio's app surface (forced-dark dot stage + editor titlebar)
// so they read as part of the video editor, not the marketing site. Each section is an icon card with a
// staggered reveal; a quiet link returns home. Pages resolve their own copy and pass it in, keeping the
// typed translation keys with each page and this component presentational.
export const PolicyPage = ({
  path,
  seoTitle,
  seoDescription,
  badge,
  title,
  intro,
  updated,
  sections,
}: PolicyPageProps) => {
  const { t } = useTranslation('common');

  return (
    <>
      <Seo title={seoTitle} description={seoDescription} path={path} />
      <StudioSurface kicker={badge} title={title} subtitle={intro}>
        <div className="mx-auto max-w-3xl">
          <p className="mb-8 inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-surface-2/60 px-3 py-1 text-xs text-muted-foreground">
            {updated}
          </p>

          <div className="space-y-4">
            {sections.map(({ Icon, heading, body }, index) => (
              <Reveal key={heading} delay={index * 80}>
                <Card interactive className="p-6 sm:p-7">
                  <div className="flex items-start gap-4">
                    <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-400 ring-1 ring-brand-500/20">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="mb-1.5 font-display text-lg font-semibold text-foreground">{heading}</h2>
                      <p className="leading-relaxed text-muted-foreground">{body}</p>
                    </div>
                  </div>
                </Card>
              </Reveal>
            ))}
          </div>

          <Reveal delay={sections.length * 80 + 80} className="mt-10">
            <Link
              to="/"
              className="group inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowRight className="h-4 w-4 rotate-180 transition-transform group-hover:-translate-x-0.5" />
              {t('nav.home')}
            </Link>
          </Reveal>
        </div>
      </StudioSurface>
    </>
  );
};
