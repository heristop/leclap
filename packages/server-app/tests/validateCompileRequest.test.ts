import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { validateCompileRequest } from '../src/templateValidation.js';
import type { VideoFile } from '../src/compile.js';

const noVideos: VideoFile[] = [];

describe('validateCompileRequest', () => {
  it('rejects a missing template with a 400', () => {
    const result = validateCompileRequest(null, noVideos);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.outcome.statusCode).toBe(400);
      expect(result.outcome.errorMessage).toMatch(/missing/i);
    }
  });

  it('rejects a structurally malformed template (sections not an array) with a 400', () => {
    const result = validateCompileRequest({ sections: 'nope' }, noVideos);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.outcome.statusCode).toBe(400);
      expect(result.outcome.errorMessage).toMatch(/invalid template/i);
      // The message must summarize the offending path without leaking a full stack/tree.
      expect(result.outcome.errorMessage).toMatch(/sections/);
    }
  });

  it('rejects a section with an unknown type with a 400', () => {
    const result = validateCompileRequest({ sections: [{ name: 's', type: 'totally_bogus' }] }, noVideos);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.outcome.statusCode).toBe(400);
    }
  });

  it('rejects a project_video template when no video files were uploaded', () => {
    const result = validateCompileRequest({ sections: [{ name: 'v', type: 'project_video' }] }, noVideos);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.outcome.statusCode).toBe(400);
      expect(result.outcome.errorMessage).toMatch(/no video files/i);
    }
  });

  it('accepts a valid template built from a color background and returns the parsed descriptor', () => {
    const result = validateCompileRequest(
      { sections: [{ name: 'bg', type: 'color_background', options: { backgroundColor: '#fff' } }] },
      noVideos
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.descriptor.sections?.[0]?.name).toBe('bg');
    }
  });

  it('accepts a valid project_video template once a video file is provided', () => {
    const videoFiles: VideoFile[] = [{ path: '/tmp/req/videos/v.mp4', section: 'v' }];
    const result = validateCompileRequest({ sections: [{ name: 'v', type: 'project_video' }] }, videoFiles);

    expect(result.ok).toBe(true);
  });
});
