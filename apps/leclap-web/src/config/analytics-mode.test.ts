// The mode decides two things that must agree: which tag the build puts in index.html, and whether
// the app asks for consent. A disagreement is silent and shows up as either an unasked cookie or a
// banner over a site that sets none — so both sides read these pure functions, and this pins them.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_BLOCK,
  UMAMI_ENV_KEYS,
  UMAMI_TAG_ID,
  analyticsMode,
  consentRequired,
  umamiConfig,
} from './analytics-mode';

const GA_ID = 'G-RLQZSC8H80';
const UMAMI = { VITE_UMAMI_SRC: 'https://stats.example.test/script.js', VITE_UMAMI_WEBSITE_ID: 'website-id' };

describe('analyticsMode', () => {
  it('runs GA when only the property is configured', () => {
    expect(analyticsMode({}, GA_ID)).toBe('ga');
    expect(consentRequired(analyticsMode({}, GA_ID))).toBe(true);
  });

  it('runs Umami when both halves are set, and asks for no consent', () => {
    expect(analyticsMode(UMAMI, GA_ID)).toBe('umami');
    expect(consentRequired(analyticsMode(UMAMI, GA_ID))).toBe(false);
  });

  it('lets Umami win over a GA property left behind by the migration', () => {
    // Measuring twice is worse than measuring once — and it would keep the banner alive on a site
    // that no longer sets a cookie.
    expect(analyticsMode(UMAMI, GA_ID)).toBe('umami');
  });

  it('ignores a half-configured Umami rather than shipping a tag that cannot send', () => {
    expect(umamiConfig({ VITE_UMAMI_SRC: UMAMI.VITE_UMAMI_SRC })).toBeUndefined();
    expect(umamiConfig({ VITE_UMAMI_WEBSITE_ID: UMAMI.VITE_UMAMI_WEBSITE_ID })).toBeUndefined();
    expect(analyticsMode({ VITE_UMAMI_SRC: UMAMI.VITE_UMAMI_SRC }, GA_ID)).toBe('ga');
  });

  it('treats blank-only values as unset', () => {
    expect(analyticsMode({ VITE_UMAMI_SRC: '  ', VITE_UMAMI_WEBSITE_ID: '  ' }, '   ')).toBe('none');
  });

  it('measures nothing when neither is configured, but still asks', () => {
    expect(analyticsMode({}, '')).toBe('none');
    // The GA snippet is authored in index.html and only the Umami swap removes it, so an empty
    // measurement id must not take the banner away while the snippet is still on the page.
    expect(consentRequired(analyticsMode({}, ''))).toBe(true);
  });
});

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file: string): string => readFileSync(path.join(appDir, file), 'utf8');

// The build swaps the block by regex. Nothing typechecks index.html, so an edit that drops the
// markers would leave the GA snippet in place under Umami — a tag nobody consented to.
describe('the swap markers in index.html', () => {
  const html = read('index.html');

  it('marks a block that holds the GA snippet', () => {
    const block = html.match(ANALYTICS_BLOCK)?.[0];

    expect(block).toBeDefined();
    expect(block).toContain('loadGoogleAnalytics');
    expect(block).toContain('googletagmanager.com');
  });

  it('leaves no analytics outside the block for the swap to miss', () => {
    expect(html.replace(ANALYTICS_BLOCK, '')).not.toContain('googletagmanager.com');
  });
});

// vite.config.ts decides the same thing this file does, over the same env keys, because the project
// reference keeps it out of reach of app source. Neither side can import the other, so what holds
// them together is here: a change to one that the other does not follow fails this.
describe('the build half of the decision', () => {
  const config = read('vite.config.ts');

  it('reads the same env keys, so the tag and the mode cannot disagree', () => {
    for (const key of UMAMI_ENV_KEYS) {
      expect(config, `vite.config.ts no longer reads ${key}`).toContain(key);
    }
  });

  it('swaps the same block this file names', () => {
    expect(config).toContain(ANALYTICS_BLOCK.source);
  });

  it('emits a tag lib/umami.ts can find, with auto-track off', () => {
    // Auto-track would report the landing page a second time, on top of usePageViews().
    expect(config).toContain('data-auto-track="false"');
    expect(config).toContain(`id="${UMAMI_TAG_ID}"`);
  });

  it('escapes attribute values, so a stray quote in the env cannot open markup', () => {
    expect(config).toContain('&quot;');
  });
});
