import { describe, it, expect } from 'vitest';
import { textEffectCss } from './textEffectCss';

describe('textEffectCss', () => {
  it('returns no styles without an effect', () => {
    expect(textEffectCss(undefined, 1)).toEqual({});
    expect(textEffectCss({}, 1)).toEqual({});
  });

  it('renders the default shadow (#000000@0.6 offset 2,2 — engine SHADOW_DEFAULTS)', () => {
    expect(textEffectCss({ shadow: true }, 1)).toEqual({ textShadow: '2px 2px rgba(0, 0, 0, 0.6)' });
  });

  it('renders the default outline (#000000 width 2 — engine OUTLINE_DEFAULTS)', () => {
    expect(textEffectCss({ outline: true }, 1)).toEqual({ WebkitTextStroke: '2px #000000' });
  });

  it('scales the engine px by the preview factor', () => {
    expect(textEffectCss({ shadow: true, outline: true }, 0.5)).toEqual({
      textShadow: '1px 1px rgba(0, 0, 0, 0.6)',
      WebkitTextStroke: '1px #000000',
    });
  });

  it('honours custom shadow colour/offsets, layering over the defaults', () => {
    expect(textEffectCss({ shadow: { color: '#FF0000', dx: 4 } }, 1)).toEqual({
      textShadow: '4px 2px #FF0000',
    });
  });

  it('honours custom outline colour/width and converts @opacity tokens', () => {
    expect(textEffectCss({ outline: { color: '#112233@0.5', width: 3 } }, 1)).toEqual({
      WebkitTextStroke: '3px rgba(17, 34, 51, 0.5)',
    });
  });
});
