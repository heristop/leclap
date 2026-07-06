import { describe, it, expect } from 'vitest';
import { colorDraftFromValue, filterColorDraft, commitColorDraft } from './color-picker.logic';

describe('colorDraftFromValue', () => {
  it('shows a hex value without its # prefix', () => {
    expect(colorDraftFromValue('#ff0044')).toBe('ff0044');
  });

  it('shows a {{ token }} as its bare variable name', () => {
    expect(colorDraftFromValue('{{ brand }}')).toBe('brand');
    expect(colorDraftFromValue('{{color2}}')).toBe('color2');
  });
});

describe('filterColorDraft', () => {
  it('keeps hex digits and variable-name characters, dropping braces/#/spaces', () => {
    expect(filterColorDraft('ff0044')).toBe('ff0044');
    expect(filterColorDraft('{{ brand }}')).toBe('brand');
    expect(filterColorDraft('#ff0044')).toBe('ff0044');
    expect(filterColorDraft('my-var!')).toBe('myvar');
  });
});

describe('commitColorDraft', () => {
  const known = ['brand', 'accent', 'color1'];

  it('commits a valid hex as a normalized #rrggbb', () => {
    expect(commitColorDraft('FF0044', known)).toBe('#ff0044');
    expect(commitColorDraft('abc', [])).toBe('#aabbcc');
  });

  it('commits a known variable name as its {{ name }} token', () => {
    expect(commitColorDraft('brand', known)).toBe('{{ brand }}');
    expect(commitColorDraft('color1', known)).toBe('{{ color1 }}');
  });

  it('prefers the variable when a name is also valid hex', () => {
    expect(commitColorDraft('facade', [...known, 'facade'])).toBe('{{ facade }}');
  });

  it('rejects drafts that are neither hex nor a known variable', () => {
    expect(commitColorDraft('nope', known)).toBeNull();
    expect(commitColorDraft('', known)).toBeNull();
  });
});
