import { ProjectMapper } from './ProjectMapper';
import { Project as DomainProject } from '@/src/domain/entities/Project';
import { ProjectStatus } from '@/src/domain/valueObjects/ProjectStatus';
import { VideoMetadata } from '@/src/domain/valueObjects/VideoMetadata';
import type { Project as UIProject } from '@/src/types';

const domainProject = (id = 'p1') =>
  new DomainProject({
    id,
    name: 'My Project',
    templateName: 'portrait.json',
    templateContent: { sections: [] },
    status: ProjectStatus.COMPLETED,
    formData: { name: 'Alex' },
    recordedVideos: {
      video_1: new VideoMetadata({
        path: '/v1.mp4',
        orientation: 'landscape',
        duration: 10,
        trim: { start: 1, end: 8 },
        crop: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
      }),
    },
    createdAt: new Date('2026-03-01T00:00:00.000Z'),
    updatedAt: new Date('2026-03-02T00:00:00.000Z'),
    outputVideoUri: '/out.mp4',
  });

describe('ProjectMapper.toUI', () => {
  it('maps domain fields to the UI shape', () => {
    const ui = ProjectMapper.toUI(domainProject());

    expect(ui.id).toBe('p1');
    expect(ui.status).toBe('completed');
    expect(ui.formData).toEqual({ name: 'Alex' });
    expect(ui.outputVideoUri).toBe('/out.mp4');
    expect(ui.createdAt).toBe('2026-03-01T00:00:00.000Z');
    expect(ui.updatedAt).toBe('2026-03-02T00:00:00.000Z');
  });

  it('carries trim/crop into recordedVideos', () => {
    const ui = ProjectMapper.toUI(domainProject());

    expect(ui.recordedVideos.video_1.trim).toEqual({ start: 1, end: 8 });
    expect(ui.recordedVideos.video_1.crop).toEqual({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  });

  it('defaults orientation to portrait and thumbnailUri to null when absent', () => {
    const p = domainProject();
    p.recordedVideos.video_2 = new VideoMetadata({ path: '/v2.mp4' }); // no orientation
    const ui = ProjectMapper.toUI(p);

    expect(ui.recordedVideos.video_2.orientation).toBe('portrait');
    expect(ui.thumbnailUri).toBeNull();
  });

  it('preserves a present thumbnailUri', () => {
    const p = domainProject();
    p.thumbnailUri = '/thumb.jpg';

    expect(ProjectMapper.toUI(p).thumbnailUri).toBe('/thumb.jpg');
  });
});

describe('ProjectMapper.toDomain', () => {
  it('maps UI status strings to the ProjectStatus enum', () => {
    const base: UIProject = {
      id: 'p',
      name: 'n',
      templateName: 't',
      templateContent: { sections: [] } as UIProject['templateContent'],
      status: 'processing',
      formData: {},
      recordedVideos: {},
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    expect(ProjectMapper.toDomain(base).status).toBe(ProjectStatus.PROCESSING);
    expect(ProjectMapper.toDomain({ ...base, status: 'failed' }).status).toBe(ProjectStatus.FAILED);
  });

  it('builds VideoMetadata instances carrying trim/crop', () => {
    const ui: UIProject = {
      id: 'p',
      name: 'n',
      templateName: 't',
      templateContent: {} as UIProject['templateContent'],
      status: 'draft',
      formData: {},
      recordedVideos: {
        video_1: { path: '/v.mp4', orientation: 'portrait', trim: { start: 2, end: 6 } },
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const domain = ProjectMapper.toDomain(ui);

    expect(domain.recordedVideos.video_1).toBeInstanceOf(VideoMetadata);
    expect(domain.recordedVideos.video_1.trim).toEqual({ start: 2, end: 6 });
  });
});

describe('ProjectMapper.toUIArray', () => {
  it('maps an array of domain projects to UI projects', () => {
    const second = domainProject('p2');
    const list = ProjectMapper.toUIArray([domainProject(), second]);

    expect(list).toHaveLength(2);
    expect(list.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(list[0].status).toBe('completed');
  });

  it('returns an empty array for no projects', () => {
    expect(ProjectMapper.toUIArray([])).toEqual([]);
  });
});

describe('ProjectMapper round-trip', () => {
  it('preserves trim/crop through toUI -> toDomain', () => {
    const ui = ProjectMapper.toUI(domainProject());
    const back = ProjectMapper.toDomain(ui);

    expect(back.recordedVideos.video_1.trim).toEqual({ start: 1, end: 8 });
    expect(back.recordedVideos.video_1.crop).toEqual({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
    expect(back.status).toBe(ProjectStatus.COMPLETED);
  });
});
