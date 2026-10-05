import { describe, expect, it } from 'vitest';
import { capOutput, errorCode, fail, ok, revisionConflict } from './results';

describe('results', () => {
  it('ok carries a summary line and the structured payload as JSON', () => {
    const result = ok({ a: 1 }, 'Done.');

    expect(result.content[0].text).toBe('Done.\n{"a":1}');
    expect(result.structuredContent).toEqual({ a: 1 });
    expect(result.isError).toBeUndefined();
  });

  it('fail is isError with JSON { code, message, ...extras }', () => {
    const result = fail('busy', 'Wait.', { hint: 'Retry.' });

    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text)).toEqual({ code: 'busy', message: 'Wait.', hint: 'Retry.' });
    expect(errorCode(result)).toBe('busy');
    expect(errorCode(ok({}))).toBeUndefined();
  });

  it('revision conflicts use the MCP wording', () => {
    expect(revisionConflict().content[0].text).toContain('revision_conflict: template changed');
  });

  it('caps oversized output with a hint', () => {
    const big = ok({ text: 'x'.repeat(210 * 1024) });
    const capped = capOutput(big, 'Ask for less.');

    expect(errorCode(capped)).toBe('too_large');
    expect(capped.structuredContent?.hint).toBe('Ask for less.');
    expect(capOutput(ok({ small: true }), 'n/a').isError).toBeUndefined();
  });
});
