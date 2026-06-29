import { describe, it, expect } from 'vitest';
import { formatValidation } from '../src/commands/validate';

// picocolors honours NO_COLOR; strip any ANSI so assertions match the text regardless of env.
const plain = (s: string): string => s.replace(/\[[0-9;]*m/g, '');

describe('formatValidation', () => {
  it('reports a valid template on one line', () => {
    const lines = formatValidation({ success: true, errors: [] }).map(plain);
    expect(lines.join('\n')).toContain('valid');
    expect(lines.some((l) => l.includes('✗'))).toBe(false);
  });

  it('lists each error as "✗ <path> — <message>"', () => {
    const lines = formatValidation({
      success: false,
      errors: [
        { path: 'sections[0].type', message: 'unknown section type', code: 'invalid' },
        { path: 'global.music.url', message: 'must be a url', code: 'invalid_url' },
      ],
    }).map(plain);

    const text = lines.join('\n');
    expect(text).toContain('✗ sections[0].type — unknown section type');
    expect(text).toContain('✗ global.music.url — must be a url');
    expect(text).toContain('2'); // a count of problems is surfaced
  });

  it('falls back gracefully when there are no error details', () => {
    const lines = formatValidation({ success: false }).map(plain);
    expect(lines.join('\n').toLowerCase()).toContain('invalid');
  });
});
