import { describe, it, expect } from 'vitest';
import {
  colorTokenName,
  resolveColorToken,
  resolvePreviewColor,
  toColorVariableMap,
} from '../src/editor/templateEditorModel';

describe('colorTokenName', () => {
  it('extracts the name from a full-string {{ token }}', () => {
    expect(colorTokenName('{{ brand }}')).toBe('brand');
    expect(colorTokenName('{{brand}}')).toBe('brand');
    expect(colorTokenName('{{ color2 }}')).toBe('color2');
  });

  it('rejects plain colours and partial tokens', () => {
    expect(colorTokenName('#ff0044')).toBeNull();
    expect(colorTokenName('red')).toBeNull();
    expect(colorTokenName('x {{ brand }}')).toBeNull();
    expect(colorTokenName('')).toBeNull();
  });
});

describe('resolveColorToken', () => {
  const vars = { brand: '#ff0044', accent: '{{ brand }}', greeting: 'hello' };

  it('passes non-token values through untouched', () => {
    expect(resolveColorToken('#ffffff', vars)).toBe('#ffffff');
    expect(resolveColorToken('red', vars)).toBe('red');
  });

  it('resolves a {{ name }} token from the variable map', () => {
    expect(resolveColorToken('{{ brand }}', vars)).toBe('#ff0044');
  });

  it('follows a token chain one level deep (variable pointing at a variable)', () => {
    expect(resolveColorToken('{{ accent }}', vars)).toBe('#ff0044');
  });

  it('resolves {{ colorN }} from the colorsList (1-indexed)', () => {
    expect(resolveColorToken('{{ color1 }}', vars, ['#111111', '#222222'])).toBe('#111111');
    expect(resolveColorToken('{{ color2 }}', vars, ['#111111', '#222222'])).toBe('#222222');
  });

  it('falls back to a colorsList array carried inside the variable map', () => {
    expect(resolveColorToken('{{ color2 }}', { colorsList: ['#111111', '#222222'] })).toBe('#222222');
  });

  it('returns null for unresolvable tokens and empty values', () => {
    expect(resolveColorToken('{{ missing }}', vars)).toBeNull();
    expect(resolveColorToken('{{ color3 }}', vars, ['#111111'])).toBeNull();
    expect(resolveColorToken('', vars)).toBeNull();
    expect(resolveColorToken(undefined, vars)).toBeNull();
  });

  it('stops on self-referencing token cycles instead of looping', () => {
    expect(resolveColorToken('{{ loop }}', { loop: '{{ loop }}' })).toBeNull();
  });
});

describe('resolvePreviewColor', () => {
  it('resolves tokens and keeps the raw value when unresolvable', () => {
    expect(resolvePreviewColor('{{ brand }}', { brand: '#ff0044' })).toBe('#ff0044');
    expect(resolvePreviewColor('#ffffff', { brand: '#ff0044' })).toBe('#ffffff');
    expect(resolvePreviewColor('{{ missing }}', { brand: '#ff0044' })).toBe('{{ missing }}');
  });
});

describe('toColorVariableMap', () => {
  it('builds a name -> value map, skipping blank names', () => {
    expect(
      toColorVariableMap([
        { name: 'brand', value: '#ff0044' },
        { name: ' ', value: '#000000' },
        { name: 'accent', value: '#00ff88' },
      ])
    ).toEqual({ brand: '#ff0044', accent: '#00ff88' });
  });
});
