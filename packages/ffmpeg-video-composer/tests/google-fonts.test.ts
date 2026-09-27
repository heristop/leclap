import { describe, it, expect } from 'vitest';
import { isFontRef, fontRefSlug } from '@/core/fonts';
import { googleCssUrl, extractTtfUrl } from '@/core/google-fonts';

// A resolved font is authored as an object so it stays structurally distinct from a registry id — a
// typo in `"bebas"` must stay a local validator error, never a network round-trip.
describe('isFontRef', () => {
  it('recognises an object carrying a family', () => {
    expect(isFontRef({ family: 'Inter' })).toBe(true);
  });

  it('rejects a registry id', () => {
    expect(isFontRef('bebas')).toBe(false);
  });

  it('rejects a raw ttf filename', () => {
    expect(isFontRef('Oswald.ttf')).toBe(false);
  });
});

// The slug is a CACHE KEY ONLY — written, never parsed back. Decoding a slug to a family name is
// lossy exactly where it matters ("Press Start 2P"), so nothing may depend on reversing it.
describe('fontRefSlug', () => {
  it('defaults to weight 400 normal', () => {
    expect(fontRefSlug({ family: 'Inter' })).toBe('google-inter-400.ttf');
  });

  it('encodes an explicit weight', () => {
    expect(fontRefSlug({ family: 'Inter', weight: 700 })).toBe('google-inter-700.ttf');
  });

  it('encodes italic style', () => {
    expect(fontRefSlug({ family: 'Inter', weight: 700, style: 'italic' })).toBe('google-inter-700-italic.ttf');
  });

  it('slugifies a multi-word family', () => {
    expect(fontRefSlug({ family: 'Playfair Display' })).toBe('google-playfair-display-400.ttf');
  });

  it('keeps digits in a family name distinct', () => {
    expect(fontRefSlug({ family: 'Press Start 2P' })).toBe('google-press-start-2p-400.ttf');
  });

  it('gives two weights of one family different keys', () => {
    expect(fontRefSlug({ family: 'Inter', weight: 400 })).not.toBe(fontRefSlug({ family: 'Inter', weight: 700 }));
  });
});

// css2 takes explicit ital,wght axes, which map 1:1 onto the ref and make Google return a STATIC
// instance at the requested weight — the reason a variable family can't silently render as Regular.
describe('googleCssUrl', () => {
  it('requests the default regular face', () => {
    expect(googleCssUrl({ family: 'Inter' })).toBe('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400');
  });

  it('requests an explicit weight', () => {
    expect(googleCssUrl({ family: 'Inter', weight: 700 })).toBe(
      'https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,700'
    );
  });

  it('sets the ital axis for italic', () => {
    expect(googleCssUrl({ family: 'Inter', weight: 700, style: 'italic' })).toBe(
      'https://fonts.googleapis.com/css2?family=Inter:ital,wght@1,700'
    );
  });

  it('encodes a multi-word family with +', () => {
    expect(googleCssUrl({ family: 'Playfair Display' })).toBe(
      'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400'
    );
  });
});

describe('extractTtfUrl', () => {
  const css = `@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 700;
  src: url(https://fonts.gstatic.com/s/inter/v20/UcCO3Fwr.ttf) format('truetype');
}`;

  it('pulls the truetype url out of a css2 response', () => {
    expect(extractTtfUrl(css)).toBe('https://fonts.gstatic.com/s/inter/v20/UcCO3Fwr.ttf');
  });

  it('returns null for a woff2 response (what a browser UA gets)', () => {
    const woff2 = "src: url(https://fonts.gstatic.com/s/inter/v20/UcCO3Fwr.woff2) format('woff2');";
    expect(extractTtfUrl(woff2)).toBeNull();
  });

  // The host pin is load-bearing for the SSRF guard — an attacker-controlled CSS body must not be
  // able to redirect the download off gstatic.
  it('refuses a url on any other host', () => {
    const evil = "src: url(https://evil.example.com/s/inter/x.ttf) format('truetype');";
    expect(extractTtfUrl(evil)).toBeNull();
  });

  it('returns null when the css carries no font url', () => {
    expect(extractTtfUrl('/* nothing here */')).toBeNull();
  });
});
