import type { Template, Section, Project } from '@/src/types';
import { isSectionCompleted, getSectionInfo, EDITABLE_TYPES } from '@/src/features/templates/detail/section-status';

const project = (over: Partial<Project> = {}): Project =>
  ({ recordedVideos: {}, formData: {}, ...over }) as unknown as Project;

const section = (over: Partial<Section>): Section => ({ name: 's', type: 'form', ...over }) as unknown as Section;

describe('isSectionCompleted', () => {
  it('video/picture: done when a clip is recorded', () => {
    const s = section({ name: 'intro', type: 'project_video' });
    expect(isSectionCompleted(s, project())).toBe(false);
    expect(isSectionCompleted(s, project({ recordedVideos: { intro: { path: 'x' } } as never }))).toBe(true);
  });

  it('form: done only when every field is answered', () => {
    const s = section({ type: 'form', options: { fields: [{ name: 'a' }, { name: 'b' }] } as never });
    expect(isSectionCompleted(s, project({ formData: { a: 'x' } }))).toBe(false);
    expect(isSectionCompleted(s, project({ formData: { a: 'x', b: 'y' } }))).toBe(true);
  });

  it('music: done when a track is stored under music_<name>', () => {
    const s = section({ name: 'bg', type: 'music' });
    expect(isSectionCompleted(s, project())).toBe(false);
    expect(isSectionCompleted(s, project({ formData: { music_bg: 'track1' } }))).toBe(true);
  });
});

describe('getSectionInfo', () => {
  const template = {
    content: {
      sections: [
        { name: 'intro', type: 'project_video' },
        { name: 'note', type: 'text' }, // not editable → filtered out
        { name: 'bg', type: 'music' },
      ],
    },
  } as unknown as Template;

  it('keeps only editable section types', () => {
    const { filtered } = getSectionInfo(template, null);
    expect(filtered.map((s) => s.name)).toEqual(['intro', 'bg']);
    expect(EDITABLE_TYPES).toContain('project_video');
  });

  it('counts completed editable sections', () => {
    const p = project({ recordedVideos: { intro: { path: 'x' } } as never, formData: { music_bg: 't' } });
    expect(getSectionInfo(template, p).completed).toBe(2);
  });

  it('reports zero completed when project is null', () => {
    expect(getSectionInfo(template, null).completed).toBe(0);
  });
});
