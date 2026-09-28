import type { RenderedGeometry } from 'ffmpeg-video-composer';
import { describe, expect, it, vi } from 'vitest';

import { geometryCheckResult } from '../src/compose/renderRunner.js';
import { isGeometryJob, runGeometryJob, type GeometryJob } from '../src/worker/geometry-job.js';

const job: GeometryJob = {
  kind: 'geometry',
  descriptor: { sections: [] } as unknown as GeometryJob['descriptor'],
  options: { assetsDir: '/media', workDir: '/out' },
};

const geometry: RenderedGeometry = {
  warnings: [
    {
      code: 'text_low_contrast_rendered',
      path: 'sections[0].caption',
      message: 'renders at 1.1:1',
      severity: 'warn',
      approx: false,
    },
  ],
  measured: 1,
};

describe('isGeometryJob', () => {
  it('tells a rendered-check job from a compose job', () => {
    expect(isGeometryJob(job)).toBe(true);
    expect(isGeometryJob({ projectConfig: {}, template: {} })).toBe(false);
    expect(isGeometryJob(null)).toBe(false);
  });
});

describe('runGeometryJob', () => {
  it('runs the rendered check with the job’s descriptor and options', async () => {
    const check = vi.fn(() => Promise.resolve(geometry));

    expect(await runGeometryJob(job, check)).toEqual({ ok: true, geometry });
    expect(check).toHaveBeenCalledWith(job.descriptor, job.options);
  });

  // The check degrades on its own, but a throw that escapes it must still reach the parent as a result
  // rather than a silent exit.
  it('reports a throw as a failed job', async () => {
    const check = vi.fn(() => Promise.reject(new Error('boom')));

    expect(await runGeometryJob(job, check)).toEqual({ ok: false, error: 'boom' });
  });
});

describe('geometryCheckResult', () => {
  it('carries the measured geometry back from the worker', () => {
    expect(geometryCheckResult({ ok: true, geometry }, '')).toEqual({ ok: true, geometry });
  });

  it('turns a failed job into a failure, led by the error the worker sent', () => {
    expect(geometryCheckResult({ ok: false, error: 'boom' }, 'tail')).toEqual({
      ok: false,
      error: 'boom',
      logTail: 'tail',
    });
  });

  it('treats a success with no geometry as a failure', () => {
    expect(geometryCheckResult({ ok: true }, '')).toMatchObject({
      ok: false,
      error: expect.stringMatching(/geometry/),
    });
  });
});
