import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogoMark, type LogoMarkHandle } from './LogoMark';
import { GithubIcon, type GithubIconHandle } from './icons/github';
import { perforationStyle } from '@/lib/film-strip';

const REPO_URL = 'https://github.com/heristop/leclap';

// Site footer. Leads with the brand mark and LeClap's core promise — everything runs locally — which
// is the product's differentiator, so it gets the green "on-device" status dot used elsewhere (the
// compile overlay's "Rendering privately on your device" badge) rather than reading as plain gray text.
// Legal links sit opposite the brand; a slim meta row carries the copyright and source link.
export const Footer = () => {
  const { t } = useTranslation();
  const logoRef = useRef<LogoMarkHandle>(null);
  const githubRef = useRef<GithubIconHandle>(null);

  // Film-credits / marquee treatment: condensed Oswald, uppercase, wide tracking — with the shared
  // playhead-scrubber underline on hover, so the links read as end-of-reel credits.
  const linkClass =
    'playhead-link rounded font-display text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40';

  return (
    <footer className="relative mt-auto overflow-hidden border-t border-divider bg-surface">
      {/* Both edges carry a slowly drifting sprocket-hole row, so the footer reads as one frame of
          film running through a projector — the brand glow below the top edge is its light spilling
          into the frame. All motion stops under the global prefers-reduced-motion reset. */}
      <div
        aria-hidden="true"
        className="animate-film-drift pointer-events-none absolute inset-x-0 top-0 h-3.5"
        style={{ ...perforationStyle, backgroundPosition: 'left top' }}
      />
      <div
        aria-hidden="true"
        className="animate-film-drift pointer-events-none absolute inset-x-0 bottom-0 h-3.5"
        style={{ ...perforationStyle, backgroundPosition: 'left bottom' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-44 w-[44rem] max-w-[92vw] -translate-x-1/2 -translate-y-1/3 rounded-full bg-brand-500/[0.07] blur-3xl"
      />

      <div className="container relative mx-auto px-4 py-10">
        {/* Brand opposite the legal links. */}
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <Link
            to="/"
            viewTransition
            onMouseEnter={() => logoRef.current?.clap()}
            className="group inline-flex items-center gap-2.5 self-start rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          >
            <LogoMark
              ref={logoRef}
              className="h-9 w-9 [filter:drop-shadow(0_4px_10px_rgba(91,97,214,0.3))] transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:-rotate-6 group-hover:scale-105"
            />
            <span className="text-xl font-bold tracking-tight text-foreground">{t('brand')}</span>
          </Link>

          <nav aria-label={t('footerNav.label')} className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:justify-end">
            <Link to="/legal" viewTransition className={linkClass}>
              {t('footerNav.legal')}
            </Link>
            <span aria-hidden="true" className="text-brand-500/40">
              •
            </span>
            <Link to="/privacy" viewTransition className={linkClass}>
              {t('footerNav.privacy')}
            </Link>
            <span aria-hidden="true" className="text-brand-500/40">
              •
            </span>
            <a href={`${REPO_URL}/blob/main/LICENSE`} target="_blank" rel="noreferrer noopener" className={linkClass}>
              {t('footerNav.license')}
            </a>
          </nav>
        </div>

        {/* The privacy promise gets its own row so it reads as one statement (one line on desktop)
            rather than wrapping inside a narrow brand column. The green dot mirrors the compile
            overlay's "on-device" badge. */}
        <p className="mt-4 flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
          {/* On-device status light: a solid dot with a slow recording-light ping, so the privacy
              promise reads as "live, on your device". The ping stills under reduced-motion. */}
          <span aria-hidden="true" className="relative mt-1.5 flex h-2 w-2 shrink-0 items-center justify-center">
            <span className="tally-ping absolute h-2 w-2 rounded-full bg-[var(--color-success)]" />
            <span className="relative h-2 w-2 rounded-full bg-[var(--color-success)] shadow-[0_0_0_3px_color-mix(in_oklch,var(--color-success)_22%,transparent)]" />
          </span>
          {t('footer')}
        </p>

        {/* Meta row: copyright + source, over a lavender→pink scrubber hairline (a timeline edge). */}
        <div
          aria-hidden="true"
          className="mt-8 h-px w-full bg-gradient-to-r from-transparent via-brand-500/40 to-transparent"
        />
        <div className="mt-5 flex items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>
            © {new Date().getFullYear()} {t('brand')}
          </p>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={t('header.viewSource')}
            onMouseEnter={() => githubRef.current?.startAnimation()}
            onMouseLeave={() => githubRef.current?.stopAnimation()}
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          >
            <GithubIcon ref={githubRef} size={16} />
            <span>{t('header.github')}</span>
          </a>
        </div>
      </div>
    </footer>
  );
};
