import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import path from 'path';
import { safeSectionName } from '../src/compile.js';

describe('safeSectionName', () => {
  it('returns a normal section name unchanged', () => {
    expect(safeSectionName('intro')).toBe('intro');
    expect(safeSectionName('section_1')).toBe('section_1');
  });

  it('rejects a value containing a forward-slash path separator', () => {
    expect(() => safeSectionName('../../../../tmp/pwn')).toThrow();
    expect(() => safeSectionName('foo/bar')).toThrow();
  });

  it('rejects a value containing the parent-directory token', () => {
    expect(() => safeSectionName('..')).toThrow();
    expect(() => safeSectionName('a..b')).not.toThrow();
  });

  it('does not produce a name that escapes a target directory once joined', () => {
    const videosDir = '/srv/build/tmp/req-123/videos';
    // A malicious filename's parsed section must never resolve outside videosDir.
    const malicious = '../../../../tmp/pwn';

    expect(() => safeSectionName(malicious)).toThrow();

    // And a safe name stays inside.
    const safe = safeSectionName('intro');
    const finalPath = path.resolve(path.join(videosDir, `${safe}.mov`));
    expect(finalPath.startsWith(path.resolve(videosDir) + path.sep)).toBe(true);
  });

  it('rejects backslash separators as well', () => {
    expect(() => safeSectionName(String.raw`foo\bar`)).toThrow();
  });
});
