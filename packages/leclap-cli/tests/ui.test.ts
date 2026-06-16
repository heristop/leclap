import { describe, it, expect } from 'vitest';
import { success, fail, step, hint, heading } from '../src/ui';

describe('ui vocabulary', () => {
  it('success shows a check and the text', () => {
    expect(success('done')).toContain('✓');
    expect(success('done')).toContain('done');
  });

  it('fail shows a cross and the text', () => {
    expect(fail('nope')).toContain('✗');
    expect(fail('nope')).toContain('nope');
  });

  it('step shows the step glyph and keeps the text', () => {
    expect(step('go')).toContain('›');
    expect(step('go')).toContain('go');
  });

  it('hint and heading preserve the text', () => {
    expect(hint('tip')).toContain('tip');
    expect(heading('Title')).toContain('Title');
  });
});
