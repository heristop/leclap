import type { Template, Project } from '@/src/types';
import { compileTemplate } from '@/src/features/templates/detail/compile-template';

const content = (obj: unknown): Template['content'] => obj as Template['content'];
const formData = (obj: Record<string, string>): Project['formData'] => obj as Project['formData'];

describe('compileTemplate', () => {
  it('substitutes every occurrence of a placeholder', () => {
    const out = compileTemplate(content({ a: '{{ name }}', b: ['{{ name }}'] }), formData({ name: 'Ada' }));
    expect(out).toEqual({ a: 'Ada', b: ['Ada'] });
  });

  it('leaves the source object untouched (deep clone)', () => {
    const src = content({ a: '{{ name }}' });
    compileTemplate(src, formData({ name: 'Ada' }));
    expect(src).toEqual({ a: '{{ name }}' });
  });

  it('escapes special characters in the key so it cannot inject a pattern', () => {
    const out = compileTemplate(content({ a: '{{ a.b }}', b: '{{ axb }}' }), formData({ 'a.b': 'ok' }));
    // Only the exact `a.b` placeholder is replaced — the regex-meta `.` must not match `axb`.
    expect(out).toEqual({ a: 'ok', b: '{{ axb }}' });
  });

  it('leaves unknown placeholders in place', () => {
    const out = compileTemplate(content({ a: '{{ missing }}' }), formData({}));
    expect(out).toEqual({ a: '{{ missing }}' });
  });

  it('inserts values containing $-sequences literally, not as replacement patterns', () => {
    // `$&`, `$1`, `` $` `` are String.prototype.replace special patterns; they must land verbatim.
    const out = compileTemplate(content({ a: '{{ name }}' }), formData({ name: 'price $& $1 $`' }));
    expect(out).toEqual({ a: 'price $& $1 $`' });
  });

  it('keeps the JSON valid when a value contains quotes or newlines', () => {
    const value = 'she said "hi"\nthen left \\ ok';
    const out = compileTemplate(content({ a: '{{ name }}' }), formData({ name: value }));
    expect(out).toEqual({ a: value });
  });
});
