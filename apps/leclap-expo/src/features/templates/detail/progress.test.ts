import type { Template, Section, Project } from '@/src/types';
import { computeAllDone, computeProgress } from '@/src/features/templates/detail/progress';

const template = { content: { sections: [] } } as unknown as Template;
const project = (over: Partial<Project> = {}): Project =>
  ({ recordedVideos: {}, formData: {}, ...over }) as unknown as Project;
const videoSection = (name: string): Section => ({ name, type: 'project_video' }) as unknown as Section;

describe('computeAllDone', () => {
  it('is false while loading (no project or template)', () => {
    expect(computeAllDone(null, template, [], false, false)).toBe(false);
    expect(computeAllDone(project(), undefined, [], false, false)).toBe(false);
  });

  it('is vacuously true for a template with no editable sections and no media step', () => {
    expect(computeAllDone(project(), template, [], false, false)).toBe(true);
  });

  it('requires every editable section complete', () => {
    const sections = [videoSection('a'), videoSection('b')];
    expect(
      computeAllDone(project({ recordedVideos: { a: { path: 'x' } } as never }), template, sections, false, false)
    ).toBe(false);
    expect(
      computeAllDone(
        project({ recordedVideos: { a: { path: 'x' }, b: { path: 'y' } } as never }),
        template,
        sections,
        false,
        false
      )
    ).toBe(true);
  });

  it('gates on the media step when present', () => {
    expect(computeAllDone(project(), template, [], true, false)).toBe(false);
    expect(computeAllDone(project(), template, [], true, true)).toBe(true);
  });
});

describe('computeProgress', () => {
  it('counts sections only when there is no media step', () => {
    expect(computeProgress([videoSection('a'), videoSection('b')], 1, false, false)).toEqual({
      totalItems: 2,
      totalDone: 1,
    });
  });

  it('adds the media step to totals and to done when complete', () => {
    expect(computeProgress([videoSection('a')], 1, true, false)).toEqual({ totalItems: 2, totalDone: 1 });
    expect(computeProgress([videoSection('a')], 1, true, true)).toEqual({ totalItems: 2, totalDone: 2 });
  });
});
