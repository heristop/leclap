import { describe, expect, it } from 'vitest';
import { documentTitle } from './seo-title';
import shell from '@/i18n/locales/en/shell.json';

// `titleVerbatim` exists so a route whose bundle title already reads as a full sentence (the home
// page, /compare/remotion) isn't given a second " — LeClap". The risk it introduces is that the flag
// leaks to pages that never asked for it, which is what these pin down.

describe('documentTitle', () => {
  it('suffixes the brand on an ordinary route', () => {
    expect(documentTitle('About', '/about', 'fallback')).toBe('About — LeClap');
  });

  it('emits a titleVerbatim route as-is', () => {
    expect(documentTitle('LeClap vs Remotion — compared', '/compare/remotion', 'fallback')).toBe(
      'LeClap vs Remotion — compared'
    );
  });

  // The 404 renders <Seo title={t('notFound.seoTitle')} noindex /> with no path. <Seo> defaults the
  // path to '/' for its canonical, and '/' is titleVerbatim — so reading the defaulted path here
  // would strip the brand from the 404's tab title. It must keep the suffix.
  it('keeps the brand on a page that passes no path (the 404)', () => {
    expect(documentTitle(shell.notFound.seoTitle, undefined, 'fallback')).toBe('Page Not Found — LeClap');
  });

  it('falls back on a missing or empty title', () => {
    expect(documentTitle(undefined, '/', 'LeClap — the default')).toBe('LeClap — the default');
    expect(documentTitle('', '/about', 'LeClap — the default')).toBe('LeClap — the default');
  });
});
