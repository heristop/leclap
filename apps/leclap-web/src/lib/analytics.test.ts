import { describe, expect, it } from 'vitest';
import { measurementAllowed, parseConsent } from './analytics';

// The consent gate is the point of this module: gtag.js must not be requested unless the visitor said
// yes, and a stale or hand-edited storage value must not read as one. Both functions are pure, so this
// needs no DOM.
describe('parseConsent', () => {
  it('reads back the two answers the banner writes', () => {
    expect(parseConsent('granted')).toBe('granted');
    expect(parseConsent('denied')).toBe('denied');
  });

  it('treats an unanswered visitor as unanswered', () => {
    expect(parseConsent(null)).toBeNull();
  });

  it('rejects anything else, so junk in storage cannot pass for a yes', () => {
    expect(parseConsent('true')).toBeNull();
    expect(parseConsent('GRANTED')).toBeNull();
    expect(parseConsent('')).toBeNull();
  });
});

describe('measurementAllowed', () => {
  const base = { consent: 'granted' as const, consentRequired: true, prod: true, bot: false };

  it('allows measurement for a human who accepted, in production', () => {
    expect(measurementAllowed(base)).toBe(true);
  });

  it('refuses without an explicit yes', () => {
    expect(measurementAllowed({ ...base, consent: null })).toBe(false);
    expect(measurementAllowed({ ...base, consent: 'denied' })).toBe(false);
  });

  it('measures without an answer under a tracker that asks for none', () => {
    // Umami sets no cookie, so nobody is ever asked — and an unanswered visitor must not be the
    // reason a cookieless page view is dropped.
    expect(measurementAllowed({ ...base, consentRequired: false, consent: null })).toBe(true);
  });

  it('still refuses in development and for crawlers when no consent is required', () => {
    // The consent half is the only one the tracker gets to relax: a dev page load and a crawler are
    // wrong in the numbers whoever counts them.
    expect(measurementAllowed({ ...base, consentRequired: false, consent: null, prod: false })).toBe(false);
    expect(measurementAllowed({ ...base, consentRequired: false, consent: null, bot: true })).toBe(false);
  });

  it('refuses in development, so local page loads stay out of the property', () => {
    expect(measurementAllowed({ ...base, prod: false })).toBe(false);
  });

  it('refuses for crawlers and automation, which never answered the banner themselves', () => {
    expect(measurementAllowed({ ...base, bot: true })).toBe(false);
  });
});
