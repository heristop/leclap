import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/presentation/components/ui';
import { ArrowLeft, ChevronDown } from '@/presentation/components/icons';
import { HomeIcon } from '@/presentation/components/icons/home';
import { RotateCCWIcon } from '@/presentation/components/icons/rotate-ccw';
import { CopyIcon } from '@/presentation/components/icons/copy';
import { GithubIcon } from '@/presentation/components/icons/github';
import { useIconHover } from '@/presentation/components/icons/useIconHover';
import type { ClappyReactionName } from '@/presentation/components/clappy';
import { ErrorScene, SceneActions, SceneMessage, type SceneTone } from './error-scene';
import { errorReport, issueUrl, statusTimecode, thrownMessage, type RouteErrorKind } from './route-error.logic';

export type ProblemKind = Exclude<RouteErrorKind, 'notFound'>;

// How Clappy takes each problem, and the slate's light: a garbled request puzzles him, a new version gets a
// wink, no connection puts him to sleep, and a crash is a cut — the only one lit red, being the only one
// that's ours to fix.
const CAST: Record<ProblemKind, { reaction: ClappyReactionName; tone: SceneTone }> = {
  badRequest: { reaction: 'puzzle', tone: 'brand' },
  update: { reaction: 'wink', tone: 'success' },
  offline: { reaction: 'doze', tone: 'muted' },
  crash: { reaction: 'cut', tone: 'error' },
};

export interface ProblemSceneProps {
  kind: ProblemKind;
  error: unknown;
  /** The HTTP status of a thrown route response, if that is what was thrown. */
  status: number | undefined;
  /** Live: an offline page says so when the connection comes back. */
  online: boolean;
  /** Where it happened, for the report. */
  path: string;
}

/**
 * Every error page that isn't a 404: a request that can't be served (4xx), a newer version than this tab's,
 * no connection, or a crash. Each says what happened in plain words and offers the one thing that fixes it
 * first: reload, except for a bad request, which only a different link fixes. A crash also carries the
 * technical details, to copy or to report.
 */
export const ProblemScene = ({ kind, error, status, online, path }: ProblemSceneProps) => {
  const { t } = useTranslation();
  const { reaction, tone } = CAST[kind];
  const back = kind === 'offline' && online;

  const eyebrow = () => {
    if (kind === 'crash' && status !== undefined) return t('routeError.crash.eyebrowStatus', { status });

    return t(`routeError.${kind}.eyebrow`, { status });
  };

  return (
    <ErrorScene
      reaction={reaction}
      slate={t(`routeError.${kind}.slate`, { status })}
      tone={tone}
      timecode={status === undefined ? undefined : statusTimecode(status)}
      eyebrow={eyebrow()}
      title={back ? t('routeError.offline.backTitle') : t(`routeError.${kind}.title`)}
    >
      <SceneMessage>{back ? t('routeError.offline.backMessage') : t(`routeError.${kind}.message`)}</SceneMessage>
      {kind === 'badRequest' ? <LeaveActions /> : <ReloadActions />}
      {kind === 'crash' && <TechnicalDetails error={error} path={path} />}
    </ErrorScene>
  );
};

// Home by a full page load: on the error page the app itself may be what broke, and a fresh load is also
// what picks up a new version.
const HomeButton = () => {
  const { t } = useTranslation();
  const { ref, hoverProps } = useIconHover();

  return (
    <Button asChild variant="secondary" size="lg" {...hoverProps}>
      <Link to="/" reloadDocument>
        <HomeIcon ref={ref} size={16} /> {t('routeError.home')}
      </Link>
    </Button>
  );
};

const ReloadActions = () => {
  const { t } = useTranslation();
  const { ref, hoverProps } = useIconHover();

  return (
    <SceneActions>
      <Button
        size="lg"
        onClick={() => {
          window.location.reload();
        }}
        {...hoverProps}
      >
        <RotateCCWIcon ref={ref} size={16} /> {t('routeError.reload')}
      </Button>
      <HomeButton />
    </SceneActions>
  );
};

/** Whether this tab has a page of this site to go back to: React Router numbers its history entries. */
const canGoBack = (): boolean => {
  const state: unknown = window.history.state;

  return typeof state === 'object' && state !== null && 'idx' in state && Number(state.idx) > 0;
};

// A bad request won't fix itself on reload: the way out is a different page.
const LeaveActions = () => {
  const { t } = useTranslation();
  const [back] = useState(canGoBack);

  return (
    <SceneActions>
      {back && (
        <Button
          size="lg"
          onClick={() => {
            window.history.back();
          }}
        >
          <ArrowLeft aria-hidden="true" className="size-4" /> {t('routeError.back')}
        </Button>
      )}
      <HomeButton />
    </SceneActions>
  );
};

/** How long "Copied" stays on the button. */
const COPIED_MS = 2000;

/**
 * The crash report, folded away: it is for whoever fixes the bug, not for reading. Copy puts it on the
 * clipboard; Report opens a pre-filled GitHub issue the visitor reviews before posting — nothing is sent
 * anywhere on its own.
 */
const TechnicalDetails = ({ error, path }: { error: unknown; path: string }) => {
  const { t } = useTranslation();
  const [report] = useState(() => errorReport(error, { path, time: new Date(), userAgent: navigator.userAgent }));
  const [copied, setCopied] = useState(false);
  const { ref: copyRef, hoverProps: copyHoverProps } = useIconHover();
  const { ref: githubRef, hoverProps: githubHoverProps } = useIconHover();

  useEffect(() => {
    if (!copied) return () => {};

    const timer = window.setTimeout(() => {
      setCopied(false);
    }, COPIED_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [copied]);

  const copy = () => {
    navigator.clipboard
      .writeText(report)
      .then(() => {
        setCopied(true);
      })
      .catch(() => {});
  };

  return (
    <details className="group mx-auto mt-10 w-full max-w-md text-left">
      <summary className="mx-auto flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 rounded-md px-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 [&::-webkit-details-marker]:hidden">
        <ChevronDown aria-hidden="true" className="size-3.5 transition-transform group-open:rotate-180" />
        {t('routeError.details')}
      </summary>
      <div className="mt-2 rounded-xl border border-foreground/10 bg-foreground/[0.03] p-3">
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[0.7rem] leading-relaxed text-muted-foreground">
          {report}
        </pre>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={copy} {...copyHoverProps}>
            <CopyIcon ref={copyRef} size={14} /> {copied ? t('routeError.copied') : t('routeError.copy')}
          </Button>
          <Button asChild size="sm" variant="ghost" {...githubHoverProps}>
            <a href={issueUrl(thrownMessage(error), report)} target="_blank" rel="noreferrer">
              <GithubIcon ref={githubRef} size={14} /> {t('routeError.report')}
            </a>
          </Button>
        </div>
        <p className="sr-only" aria-live="polite">
          {copied ? t('routeError.copied') : ''}
        </p>
      </div>
    </details>
  );
};
