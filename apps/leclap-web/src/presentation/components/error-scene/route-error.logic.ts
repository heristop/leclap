import { REPO_URL } from '@/config/site';

// What went wrong when a route fails to render, and the report a visitor can pass on. React Router hands the
// error page whatever was thrown; this sorts it into the few cases a visitor can act on differently.

export type RouteErrorKind = 'notFound' | 'badRequest' | 'update' | 'offline' | 'crash';

// What each engine says when a code-split chunk fails to load: a deploy replaced the files this tab was
// built against, or there is no connection to fetch them over.
const CHUNK_FAILURES = [
  'failed to fetch dynamically imported module', // Chrome, Edge
  'error loading dynamically imported module', // Firefox
  'importing a module script failed', // Safari
  'unable to preload css', // Vite's stylesheet preload
];

/** Whether a page's code failed to download, rather than failed to run. */
export const isChunkLoadError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();

  return CHUNK_FAILURES.some((failure) => message.includes(failure));
};

interface RouteErrorFacts {
  /** The HTTP status of a thrown route response, if that is what was thrown. */
  status: number | undefined;
  /** Whether the page's code failed to download. */
  chunk: boolean;
  /** Whether the browser was online when it happened. */
  online: boolean;
}

/**
 * The case a visitor can act on: a page that isn't there, a request that can't be served, a newer version
 * than this tab's (reload), no connection (reconnect, then reload), or a crash (ours to fix).
 */
export const routeErrorKind = ({ status, chunk, online }: RouteErrorFacts): RouteErrorKind => {
  if (status === 404) return 'notFound';

  if (status !== undefined && status >= 400 && status < 500) return 'badRequest';

  if (chunk) return online ? 'update' : 'offline';

  return 'crash';
};

/** A status as the camera's timecode, the error pages' viewfinder detail: 404 → 00:00:04:04. */
export const statusTimecode = (status: number): string => {
  const pad = (value: number) => String(value).padStart(2, '0');

  return `00:00:${pad(Math.floor(status / 100))}:${pad(status % 100)}`;
};

// The error page must never fail itself: an object JSON can't write out (a cycle, a BigInt) is named instead.
const describeObject = (value: object): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
};

/** What was thrown, in one line. */
export const thrownMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;

  if (typeof error === 'string') return error;

  if (typeof error === 'object' && error !== null && 'status' in error) {
    const { status, statusText } = error as { status: unknown; statusText?: unknown };

    return `${String(status)} ${typeof statusText === 'string' ? statusText : ''}`.trim();
  }

  if (typeof error === 'object' && error !== null) return describeObject(error);

  return String(error);
};

/** How much of the stack a report carries: enough to find the fault, short enough to paste. */
const STACK_LINES = 8;

const stackTop = (error: unknown): string[] => {
  if (!(error instanceof Error) || !error.stack) return [];

  return error.stack
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith(`${error.name}:`))
    .slice(0, STACK_LINES);
};

export interface ReportContext {
  path: string;
  time: Date;
  userAgent: string;
}

/** The error as a plain-text report for the clipboard or a GitHub issue. English whatever the page's language: it's for the maintainers. */
export const errorReport = (error: unknown, { path, time, userAgent }: ReportContext): string => {
  const stack = stackTop(error);

  return [
    `Message: ${thrownMessage(error)}`,
    `Page: ${path}`,
    `Time: ${time.toISOString()}`,
    `Browser: ${userAgent}`,
    ...(stack.length > 0 ? ['', ...stack] : []),
  ].join('\n');
};

// A new-issue address that runs too long is refused, so the title and the body are trimmed to fit.
const MAX_TITLE = 120;
const MAX_BODY = 3000;

/** A new GitHub issue on the repo, pre-filled with the report; the visitor reviews it before posting. */
export const issueUrl = (message: string, report: string): string => {
  const url = new URL(`${REPO_URL}/issues/new`);

  url.searchParams.set('title', `Error: ${message}`.slice(0, MAX_TITLE));
  url.searchParams.set('body', report.length > MAX_BODY ? `${report.slice(0, MAX_BODY)}\n…` : report);

  return url.toString();
};
