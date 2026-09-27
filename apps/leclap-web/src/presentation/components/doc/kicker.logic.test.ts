import { describe, expect, it } from 'vitest';
import { parseKicker } from './kicker.logic';

describe('parseKicker', () => {
  it('reads a plain label as prose', () => {
    expect(parseKicker('Schema-driven')).toEqual({ text: 'Schema-driven', code: false });
  });

  it('reads a backtick-wrapped label as a code identifier, without the ticks', () => {
    expect(parseKicker('`options.audioFade`')).toEqual({ text: 'options.audioFade', code: true });
    expect(parseKicker('`maps[]`')).toEqual({ text: 'maps[]', code: true });
  });

  it('needs both ticks — a stray one is just punctuation', () => {
    expect(parseKicker('`grade')).toEqual({ text: '`grade', code: false });
    expect(parseKicker('`')).toEqual({ text: '`', code: false });
  });
});
