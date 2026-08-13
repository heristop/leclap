import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { supportedLngs } from '@/i18n';
import { LANGUAGE_STORAGE_KEY, localePath } from './language';
import { BOT_PATTERN } from './isBot';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

// The first-visit language redirect ships as an inline <script> in index.html so it runs before the
// app bundle is even requested. These tests execute that exact script — the shipped source, not a
// copy — in a vm sandbox whose globals are a fake browser.
const scriptSource = (): string => {
  const match = /<script data-language-redirect>([\s\S]*?)<\/script>/.exec(html);

  if (!match) {
    throw new Error('index.html no longer contains a <script data-language-redirect> block');
  }

  return match[1];
};

type RunOptions = {
  path?: string;
  search?: string;
  hash?: string;
  languages?: string[];
  stored?: string | null;
  userAgent?: string;
  webdriver?: boolean;
  /** Simulate a browser that throws on storage access (Safari private mode, blocked cookies). */
  storageThrows?: boolean;
};

/** Run the shipped redirect script against a fake browser; returns the URL it redirected to, if any. */
const run = ({
  path = '/',
  search = '',
  hash = '',
  languages = ['en-US'],
  stored = null,
  userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605.1',
  webdriver = false,
  storageThrows = false,
}: RunOptions = {}): string | null => {
  const replace = vi.fn();
  const location = { pathname: path, search, hash, replace };
  const navigator = { languages, language: languages[0], userAgent, webdriver };
  const localStorage = {
    getItem: () => {
      if (storageThrows) {
        throw new Error('storage blocked');
      }

      return stored;
    },
  };

  runInNewContext(scriptSource(), { location, navigator, localStorage });

  return replace.mock.calls.length > 0 ? String(replace.mock.calls[0][0]) : null;
};

describe('first-visit language redirect', () => {
  it('sends a French browser landing on the root to /fr', () => {
    expect(run({ languages: ['fr-FR', 'en-US'] })).toBe('/fr');
  });

  it('picks the first language the app actually ships', () => {
    expect(run({ languages: ['ja', 'pt-BR', 'de-AT'] })).toBe('/de');
  });

  it('matches the base language regardless of region or case', () => {
    expect(run({ languages: ['ES-419'] })).toBe('/es');
  });

  it('leaves an English browser on the root', () => {
    expect(run({ languages: ['en-GB'] })).toBeNull();
  });

  it('leaves a browser we have no translation for on the root', () => {
    expect(run({ languages: ['ja', 'ko'] })).toBeNull();
  });

  it('carries the query string and hash across', () => {
    expect(run({ languages: ['it'], search: '?ref=x', hash: '#top' })).toBe('/it?ref=x#top');
  });

  it('treats a trailing slash as the root', () => {
    expect(run({ path: '/', languages: ['fr'] })).toBe('/fr');
  });
});

describe('first-visit language redirect: when it must stay out of the way', () => {
  it('never touches a URL that already carries a locale prefix', () => {
    expect(run({ path: '/fr', languages: ['de'] })).toBeNull();
  });

  it('never touches a deep link — it was shared deliberately', () => {
    expect(run({ path: '/studio', languages: ['fr'] })).toBeNull();
  });

  it('honours an explicit English choice over a French browser', () => {
    expect(run({ languages: ['fr-FR'], stored: 'en' })).toBeNull();
  });

  it('honours an explicit choice that differs from the browser language', () => {
    expect(run({ languages: ['fr-FR'], stored: 'de' })).toBe('/de');
  });

  it('ignores a stored value that is not a language we ship', () => {
    expect(run({ languages: ['fr-FR'], stored: 'klingon' })).toBe('/fr');
  });

  it('falls back to browser detection when storage is blocked', () => {
    expect(run({ languages: ['fr-FR'], storageThrows: true })).toBe('/fr');
  });

  it('never redirects a crawler, so / stays indexable as the x-default', () => {
    expect(run({ languages: ['fr-FR'], userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)' })).toBeNull();
  });

  it('never redirects headless automation', () => {
    expect(run({ languages: ['fr-FR'], webdriver: true })).toBeNull();
  });
});

// The inline script is plain ES5 in an HTML file, so it cannot import the app's constants. These
// guard against the two copies drifting apart.
describe('the inline script stays in sync with its TypeScript sources', () => {
  it('lists exactly the languages the app ships', () => {
    const match = /var LOCALES = \[([^\]]*)]/.exec(scriptSource());
    const locales = (match?.[1] ?? '').split(',').map((entry) => entry.trim().replaceAll("'", ''));

    expect(locales).toEqual([...supportedLngs]);
  });

  it('reads the same storage key the language picker writes', () => {
    expect(scriptSource()).toContain(`localStorage.getItem('${LANGUAGE_STORAGE_KEY}')`);
  });

  it('uses the same crawler heuristic as isBot', () => {
    expect(scriptSource()).toContain(BOT_PATTERN.source);
  });
});

describe('localePath', () => {
  it('adds a prefix for a non-English target', () => {
    expect(localePath('de', '/studio')).toBe('/de/studio');
  });

  it('swaps an existing prefix', () => {
    expect(localePath('de', '/fr/studio')).toBe('/de/studio');
  });

  it('drops the prefix for English', () => {
    expect(localePath('en', '/fr/studio')).toBe('/studio');
  });

  it('keeps the root bare in English', () => {
    expect(localePath('en', '/fr')).toBe('/');
  });

  it('does not leave a trailing slash on a prefixed root', () => {
    expect(localePath('it', '/')).toBe('/it');
  });
});
