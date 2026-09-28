import { describe, expect, it } from 'vitest';
import { REPO_URL } from '@/config/site';
import { errorReport, isChunkLoadError, issueUrl, routeErrorKind, statusTimecode } from './route-error.logic';

describe('isChunkLoadError', () => {
  it.each([
    ['Chrome', 'Failed to fetch dynamically imported module: https://leclap.dev/assets/Builder-abc.js'],
    ['Firefox', 'error loading dynamically imported module: https://leclap.dev/assets/Builder-abc.js'],
    ['Safari', 'Importing a module script failed.'],
    ['Vite', 'Unable to preload CSS for /assets/Builder-abc.css'],
  ])('recognises a chunk that failed to load in %s', (_, message) => {
    expect(isChunkLoadError(new TypeError(message))).toBe(true);
  });

  it('leaves every other error alone', () => {
    expect(isChunkLoadError(new TypeError('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

describe('routeErrorKind', () => {
  it('sends a missing route to the not-found scene', () => {
    expect(routeErrorKind({ status: 404, chunk: false, online: true })).toBe('notFound');
  });

  it('reads the other 4xx as a request that cannot be served', () => {
    expect(routeErrorKind({ status: 400, chunk: false, online: true })).toBe('badRequest');
    expect(routeErrorKind({ status: 422, chunk: false, online: true })).toBe('badRequest');
  });

  it('reads a chunk that failed to load as a new version, or as a lost connection', () => {
    expect(routeErrorKind({ status: undefined, chunk: true, online: true })).toBe('update');
    expect(routeErrorKind({ status: undefined, chunk: true, online: false })).toBe('offline');
  });

  it('treats a render error or a 5xx as a crash, online or not', () => {
    expect(routeErrorKind({ status: undefined, chunk: false, online: true })).toBe('crash');
    expect(routeErrorKind({ status: undefined, chunk: false, online: false })).toBe('crash');
    expect(routeErrorKind({ status: 500, chunk: false, online: true })).toBe('crash');
    expect(routeErrorKind({ status: 503, chunk: false, online: true })).toBe('crash');
  });
});

describe('statusTimecode', () => {
  it('spells the status as the camera timecode', () => {
    expect(statusTimecode(404)).toBe('00:00:04:04');
    expect(statusTimecode(400)).toBe('00:00:04:00');
    expect(statusTimecode(503)).toBe('00:00:05:03');
  });
});

describe('errorReport', () => {
  const context = { path: '/studio/new', time: new Date('2026-09-27T12:00:00Z'), userAgent: 'TestBrowser/1.0' };

  it('puts the message, the page, the time and the browser first', () => {
    const report = errorReport(new Error('Boom'), context);

    expect(report).toContain('Message: Boom');
    expect(report).toContain('Page: /studio/new');
    expect(report).toContain('Time: 2026-09-27T12:00:00.000Z');
    expect(report).toContain('Browser: TestBrowser/1.0');
  });

  it('keeps only the top of the stack', () => {
    const error = new Error('Boom');

    error.stack = [
      'Error: Boom',
      ...Array.from({ length: 30 }, (_, index) => `    at frame${index} (app.js:1:${index})`),
    ].join('\n');

    const report = errorReport(error, context);

    expect(report).toContain('at frame0');
    expect(report).not.toContain('at frame12');
  });

  it('describes what was thrown when it is not an Error', () => {
    expect(errorReport('plain string', context)).toContain('Message: plain string');
    expect(errorReport({ status: 400, statusText: 'Bad Request' }, context)).toContain('Message: 400 Bad Request');
    expect(errorReport({ code: 'E_TAKE' }, context)).toContain('Message: {"code":"E_TAKE"}');
    expect(errorReport(undefined, context)).toContain('Message: undefined');
  });

  it('never throws itself, whatever was thrown', () => {
    const circular: Record<string, unknown> = {};

    circular.self = circular;

    expect(errorReport(circular, context)).toContain('Message: [object Object]');
  });
});

describe('issueUrl', () => {
  it('opens a new issue on the repo with the report as its body', () => {
    const url = new URL(issueUrl('Boom', 'Message: Boom'));

    expect(`${url.origin}${url.pathname}`).toBe(`${REPO_URL}/issues/new`);
    expect(url.searchParams.get('title')).toBe('Error: Boom');
    expect(url.searchParams.get('body')).toContain('Message: Boom');
  });

  it('keeps the address short enough for the browser to open', () => {
    const url = issueUrl('x'.repeat(500), 'y'.repeat(20_000));

    expect(url.length).toBeLessThan(8000);
  });
});
