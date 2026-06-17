import { describe, it, expect } from 'vitest';
import { findHashQuery, insertVariableAtHash, filterVariables } from './variableInsert';

describe('findHashQuery', () => {
  it('detects a `#query` typed at the caret', () => {
    // "film #opt" with caret at the end (9)
    expect(findHashQuery('film #opt', 9)).toEqual({ start: 5, query: 'opt' });
  });

  it('detects an empty query right after a bare `#`', () => {
    expect(findHashQuery('film #', 6)).toEqual({ start: 5, query: '' });
  });

  it('detects `#` at the very start of the text', () => {
    expect(findHashQuery('#na', 3)).toEqual({ start: 0, query: 'na' });
  });

  it('ignores a `#` glued to a word (e.g. a hex colour mid-word)', () => {
    expect(findHashQuery('a#b', 3)).toBeNull();
  });

  it('returns null when there is no `#` before the caret', () => {
    expect(findHashQuery('no hash here', 12)).toBeNull();
  });

  it('only looks at the word run immediately before the caret', () => {
    // The caret sits after "more", which has no leading `#`.
    expect(findHashQuery('#one more', 9)).toBeNull();
  });

  it('allows hyphens in the query', () => {
    expect(findHashQuery('#form-1', 7)).toEqual({ start: 0, query: 'form-1' });
  });
});

describe('insertVariableAtHash', () => {
  it('replaces the `#query` span with a `{{ name }}` token and returns the caret after it', () => {
    const result = insertVariableAtHash('film #opt more', 5, 9, 'optionA1');

    expect(result.text).toBe('film {{ optionA1 }} more');
    expect(result.caret).toBe('film {{ optionA1 }}'.length);
  });

  it('handles a bare `#` at the end', () => {
    const result = insertVariableAtHash('hi #', 3, 4, 'name');

    expect(result.text).toBe('hi {{ name }}');
    expect(result.caret).toBe('hi {{ name }}'.length);
  });
});

describe('filterVariables', () => {
  it('returns the full list for an empty query', () => {
    expect(filterVariables(['optionA1', 'optionB1'], '')).toEqual(['optionA1', 'optionB1']);
  });

  it('filters case-insensitively by substring', () => {
    expect(filterVariables(['optionA1', 'optionB1', 'name'], 'opt')).toEqual(['optionA1', 'optionB1']);
    expect(filterVariables(['optionA1', 'formName'], 'NAME')).toEqual(['formName']);
  });
});
