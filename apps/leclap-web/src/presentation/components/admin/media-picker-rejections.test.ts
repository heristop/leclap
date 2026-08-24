import { describe, expect, it } from 'vitest';
import type { Rejection } from '@/lib/upload/core/types';
import { rejectionMessages } from './media-picker-rejections';

// A stand-in for i18next's `t`: echoes the key and its interpolation so the test asserts which key
// was chosen and what was passed, without depending on any locale's wording.
const t = ((key: string, vars?: Record<string, unknown>) => `${key}(${JSON.stringify(vars ?? {})})`) as never;

const rejection = (name: string, code: Rejection['errors'][number]['code']): Rejection => ({
  file: new File(['x'], name),
  errors: [{ code, message: 'dev-facing' }],
});

describe('rejectionMessages', () => {
  it('names the file and the accepted formats for a wrong type', () => {
    const [message] = rejectionMessages([rejection('notes.pdf', 'file-invalid-type')], t, 'MP4, MOV');

    expect(message).toBe('media.rejectInvalidType({"name":"notes.pdf","formats":"MP4, MOV"})');
  });

  it('reports a surplus file as too many', () => {
    const [message] = rejectionMessages([rejection('second.mp4', 'too-many-files')], t, 'MP4');

    expect(message).toBe('media.rejectTooMany({"name":"second.mp4"})');
  });

  it('reports an oversized file', () => {
    const [message] = rejectionMessages([rejection('huge.mp4', 'file-too-large')], t, 'MP4');

    expect(message).toBe('media.rejectTooLarge({"name":"huge.mp4"})');
  });

  it('returns one line per rejected file', () => {
    const messages = rejectionMessages(
      [rejection('a.pdf', 'file-invalid-type'), rejection('b.pdf', 'file-invalid-type')],
      t,
      'MP4'
    );

    expect(messages).toHaveLength(2);
  });

  // A file can carry both codes (wrong type AND oversized). One line per file, not per code —
  // two lines about the same file reads as two problems.
  it('emits one line for a file that fails on two counts', () => {
    const both: Rejection = {
      file: new File(['x'], 'huge.pdf'),
      errors: [
        { code: 'file-invalid-type', message: 'dev' },
        { code: 'file-too-large', message: 'dev' },
      ],
    };

    expect(rejectionMessages([both], t, 'MP4')).toHaveLength(1);
  });

  it('returns nothing for an empty list', () => {
    expect(rejectionMessages([], t, 'MP4')).toEqual([]);
  });
});
