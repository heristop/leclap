import { describe, expect, it } from 'vitest';
import { uniquePartialId } from './partial-id.logic';

describe('uniquePartialId', () => {
  it('keeps the normalized base when nothing uses it', () => {
    expect(uniquePartialId('flash-card', [])).toBe('local:flash-card');
  });

  it('numbers the id when the base is already stored', () => {
    expect(uniquePartialId('local:new-partial', ['local:new-partial'])).toBe('local:new-partial-2');
  });

  it('skips every suffix that is taken', () => {
    expect(uniquePartialId('intro', ['local:intro', 'local:intro-2'])).toBe('local:intro-3');
  });

  it('compares against normalized ids', () => {
    expect(uniquePartialId('Logo Bumper', ['local:LOGO-bumper'])).toBe('local:logo-bumper-2');
  });
});
