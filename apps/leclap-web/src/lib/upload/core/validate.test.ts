import { describe, expect, it } from 'vitest';
import { validateFiles } from './validate';
import type { AcceptSpec } from './types';

const VIDEO: AcceptSpec = [{ mime: 'video/*', extensions: ['.mp4'] }];

const sized = (name: string, type: string, bytes: number): File => new File([new Uint8Array(bytes)], name, { type });

describe('validateFiles', () => {
  it('accepts a matching file within the size limit', () => {
    const ok = sized('a.mp4', 'video/mp4', 10);
    expect(validateFiles([ok], { accept: VIDEO, maxSize: 100 })).toEqual({ accepted: [ok], rejections: [] });
  });

  it('rejects an oversized file with file-too-large', () => {
    const big = sized('a.mp4', 'video/mp4', 500);
    const { accepted, rejections } = validateFiles([big], { accept: VIDEO, maxSize: 100 });
    expect(accepted).toEqual([]);
    expect(rejections[0].errors[0].code).toBe('file-too-large');
  });

  it('rejects a non-matching file with file-invalid-type', () => {
    const bad = sized('a.pdf', 'application/pdf', 10);
    expect(validateFiles([bad], { accept: VIDEO }).rejections[0].errors[0].code).toBe('file-invalid-type');
  });

  // v15 discarded the whole batch; we keep what fits and report only the surplus.
  it('accepts up to the remaining limit and rejects only the overflow', () => {
    const files = [sized('a.mp4', 'video/mp4', 1), sized('b.mp4', 'video/mp4', 1), sized('c.mp4', 'video/mp4', 1)];
    const { accepted, rejections } = validateFiles(files, { accept: VIDEO, remaining: 2 });
    expect(accepted).toHaveLength(2);
    expect(rejections).toHaveLength(1);
    expect(rejections[0].errors[0].code).toBe('too-many-files');
  });

  // react-dropzone read maxFiles < 1 as Infinity, so at capacity the limit silently vanished.
  it('rejects everything when nothing remains', () => {
    const { accepted, rejections } = validateFiles([sized('a.mp4', 'video/mp4', 1)], {
      accept: VIDEO,
      remaining: 0,
    });
    expect(accepted).toEqual([]);
    expect(rejections[0].errors[0].code).toBe('too-many-files');
  });

  it('reports every applicable error for one file', () => {
    const bad = sized('a.pdf', 'application/pdf', 500);
    const codes = validateFiles([bad], { accept: VIDEO, maxSize: 100 }).rejections[0].errors.map((e) => e.code);
    expect(codes).toEqual(['file-invalid-type', 'file-too-large']);
  });
});
