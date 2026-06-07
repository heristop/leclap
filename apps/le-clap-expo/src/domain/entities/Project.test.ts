import { Project } from './Project';
import { ProjectStatus } from '../valueObjects/ProjectStatus';
import { VideoMetadata } from '../valueObjects/VideoMetadata';

const makeProject = (overrides: Parameters<typeof Project.create>[3] = {}) =>
  Project.create('My Project', 'portrait.json', { sections: [] }, overrides);

describe('Project.create', () => {
  it('applies sensible defaults', () => {
    const p = makeProject();

    expect(p.status).toBe(ProjectStatus.DRAFT);
    expect(p.formData).toEqual({});
    expect(p.recordedVideos).toEqual({});
    expect(typeof p.id).toBe('string');
    expect(p.id.length).toBeGreaterThan(0);
  });

  it('defaults updatedAt to createdAt when only createdAt is given', () => {
    const createdAt = new Date('2026-01-02T03:04:05.000Z');
    const p = makeProject({ createdAt });

    expect(p.createdAt).toBe(createdAt);
    expect(p.updatedAt).toEqual(createdAt);
  });
});

describe('Project business rules', () => {
  it('isReadyForCompilation requires DRAFT status and at least one recorded video', () => {
    const withVideo = makeProject({
      recordedVideos: { video_1: new VideoMetadata({ path: '/tmp/v.mp4' }) },
    });
    expect(withVideo.isReadyForCompilation()).toBe(true);

    const noVideo = makeProject();
    expect(noVideo.isReadyForCompilation()).toBe(false);

    const processing = makeProject({
      status: ProjectStatus.PROCESSING,
      recordedVideos: { video_1: new VideoMetadata({ path: '/tmp/v.mp4' }) },
    });
    expect(processing.isReadyForCompilation()).toBe(false);
  });

  it('isCompleted requires COMPLETED status and an output URI', () => {
    expect(makeProject({ status: ProjectStatus.COMPLETED, outputVideoUri: '/out.mp4' }).isCompleted()).toBe(true);
    expect(makeProject({ status: ProjectStatus.COMPLETED }).isCompleted()).toBe(false);
    expect(makeProject({ status: ProjectStatus.DRAFT, outputVideoUri: '/out.mp4' }).isCompleted()).toBe(false);
  });

  it('addRecordedVideo stores the clip and bumps updatedAt', () => {
    const p = makeProject({ createdAt: new Date('2020-01-01T00:00:00.000Z') });
    const before = p.updatedAt.getTime();

    p.addRecordedVideo('video_1', new VideoMetadata({ path: '/tmp/v.mp4', trim: { start: 1, end: 5 } }));

    expect(p.recordedVideos.video_1.path).toBe('/tmp/v.mp4');
    expect(p.recordedVideos.video_1.trim).toEqual({ start: 1, end: 5 });
    expect(p.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('updateStatus changes the status', () => {
    const p = makeProject();
    p.updateStatus(ProjectStatus.PROCESSING);
    expect(p.status).toBe(ProjectStatus.PROCESSING);
  });
});

describe('Project.toJSON / fromJSON', () => {
  it('round-trips a project including recorded-video trim/crop', () => {
    const original = makeProject({
      id: 'proj-1',
      status: ProjectStatus.COMPLETED,
      formData: { name: 'Alex' },
      outputVideoUri: '/out.mp4',
      thumbnailUri: '/thumb.jpg',
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-02T00:00:00.000Z'),
      recordedVideos: {
        video_1: new VideoMetadata({
          path: '/tmp/v1.mp4',
          orientation: 'portrait',
          trim: { start: 1, end: 7 },
          crop: { x: 0, y: 0, w: 0.9, h: 0.9 },
        }),
      },
    });

    const restored = Project.fromJSON(original.toJSON());

    expect(restored.id).toBe('proj-1');
    expect(restored.status).toBe(ProjectStatus.COMPLETED);
    expect(restored.formData).toEqual({ name: 'Alex' });
    expect(restored.outputVideoUri).toBe('/out.mp4');
    expect(restored.thumbnailUri).toBe('/thumb.jpg');
    expect(restored.createdAt.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(restored.recordedVideos.video_1).toBeInstanceOf(VideoMetadata);
    expect(restored.recordedVideos.video_1.trim).toEqual({ start: 1, end: 7 });
    expect(restored.recordedVideos.video_1.crop).toEqual({ x: 0, y: 0, w: 0.9, h: 0.9 });
  });

  it('fromJSON tolerates missing recordedVideos/formData/templateContent', () => {
    const restored = Project.fromJSON({
      id: 'p',
      name: 'n',
      templateName: 't',
      status: ProjectStatus.DRAFT,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(restored.recordedVideos).toEqual({});
    expect(restored.formData).toEqual({});
    expect(restored.templateContent).toEqual({});
  });
});
