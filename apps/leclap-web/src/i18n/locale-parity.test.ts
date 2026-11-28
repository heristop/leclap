// Runtime key parity for every shipped locale. `satisfies LocaleShape<Resources>` in each barrel only
// proves that no English key is missing: a key left over after English renames it, or a plural variant
// typed with the wrong suffix, still typechecks — and t() keys are not type-checked at the call site,
// so the stray key is silently ignored while the visitor reads the English fallback.
//
// So every bundle must carry exactly the English key set (plus the `_many` plural variant Romance
// languages need next to `_other`), and every string must keep the English `{{interpolations}}` and
// inline tags, or the rendered copy shows a raw token or loses a value.
import { describe, expect, it } from 'vitest';
import { LOCALE_CODES } from '@/config/site';
import { en } from './locales/en';
import { fr } from './locales/fr';
import { de } from './locales/de';
import { es } from './locales/es';
import { it as itLocale } from './locales/it';
import { pt } from './locales/pt';

const BUNDLES: Record<string, unknown> = { fr, de, es, it: itLocale, pt };

const flatten = (node: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> => {
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (value !== null && typeof value === 'object') {
      flatten(value, path, out);
      continue;
    }

    out[path] = String(value);
  }

  return out;
};

const tokens = (text: string): string[] =>
  (text.match(/\{\{[^}]+\}\}|<\/?[A-Za-z0-9]+\s*\/?>/g) ?? []).map((token) => token.replace(/\s+/g, '')).sort();

const english = flatten(en);
const englishKey = (key: string): string => (key in english ? key : key.replace(/_many$/, '_other'));

describe('locale key parity', () => {
  it('covers every shipped language', () => {
    expect(Object.keys(BUNDLES).sort()).toEqual(LOCALE_CODES.filter((code) => code !== 'en').sort());
  });

  it.each(Object.entries(BUNDLES))('%s carries every English key and nothing else', (_lng, bundle) => {
    const keys = Object.keys(flatten(bundle));

    expect(Object.keys(english).filter((key) => !keys.includes(key))).toEqual([]);
    expect(keys.filter((key) => !(englishKey(key) in english))).toEqual([]);
  });

  it.each(Object.entries(BUNDLES))('%s keeps the English interpolations and tags', (_lng, bundle) => {
    const mismatched = Object.entries(flatten(bundle))
      .filter(([key]) => englishKey(key) in english)
      .filter(([key, value]) => tokens(value).join() !== tokens(english[englishKey(key)]).join())
      .map(([key]) => key);

    expect(mismatched).toEqual([]);
  });
});
