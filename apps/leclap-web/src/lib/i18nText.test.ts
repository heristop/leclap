import { describe, it, expect } from 'vitest';
import { resolveTranslation, resolveVariables } from './i18nText';

describe('resolveTranslation', () => {
  it('returns the requested locale when present', () => {
    expect(resolveTranslation({ en: 'Hello', fr: 'Bonjour' }, 'fr')).toBe('Bonjour');
  });

  it('falls back to en when the locale is missing', () => {
    expect(resolveTranslation({ en: 'Hello', fr: 'Bonjour' }, 'de')).toBe('Hello');
  });

  it('falls back to the first present translation when en is missing', () => {
    expect(resolveTranslation({ fr: 'Bonjour', de: 'Hallo' }, 'es')).toBe('Bonjour');
  });

  it('returns undefined for an empty or missing map', () => {
    expect(resolveTranslation(undefined, 'en')).toBeUndefined();
    expect(resolveTranslation({}, 'en')).toBeUndefined();
  });
});

describe('resolveVariables', () => {
  it('substitutes known tokens', () => {
    expect(resolveVariables('{{ a }} or {{ b }}?', { a: 'Cats', b: 'Dogs' })).toBe('Cats or Dogs?');
  });

  it('joins array values with a comma', () => {
    expect(resolveVariables('Colors: {{ list }}', { list: ['red', 'blue'] })).toBe('Colors: red, blue');
  });

  it('leaves unknown tokens as-is', () => {
    expect(resolveVariables('{{ a }} and {{ missing }}', { a: 'Cats' })).toBe('Cats and {{ missing }}');
  });

  it('returns the text untouched when there are no tokens', () => {
    expect(resolveVariables('plain text', { a: 'x' })).toBe('plain text');
  });
});
