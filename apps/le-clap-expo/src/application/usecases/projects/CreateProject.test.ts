import { CreateProjectUseCase } from './CreateProject';
import { ProjectStatus } from '@/src/domain/valueObjects/ProjectStatus';
import { VideoMetadata } from '@/src/domain/valueObjects/VideoMetadata';
import { FakeProjectRepository } from '@/src/test-utils/FakeProjectRepository';

describe('CreateProjectUseCase', () => {
  it('creates and persists a project with defaults', async () => {
    const repo = new FakeProjectRepository();
    const useCase = new CreateProjectUseCase(repo);

    const project = await useCase.execute({
      name: 'Birthday',
      templateName: 'portrait.json',
      templateContent: { sections: [] },
    });

    expect(project.name).toBe('Birthday');
    expect(project.status).toBe(ProjectStatus.DRAFT);
    expect(repo.has(project.id)).toBe(true);
    expect(repo.count()).toBe(1);
  });

  it('honors provided id, status and recordedVideos', async () => {
    const repo = new FakeProjectRepository();
    const useCase = new CreateProjectUseCase(repo);

    const project = await useCase.execute({
      id: 'fixed-id',
      name: 'P',
      templateName: 'portrait.json',
      templateContent: {},
      status: ProjectStatus.PROCESSING,
      recordedVideos: { video_1: new VideoMetadata({ path: '/v.mp4' }) },
    });

    expect(project.id).toBe('fixed-id');
    expect(project.status).toBe(ProjectStatus.PROCESSING);
    expect(project.recordedVideos.video_1.path).toBe('/v.mp4');
  });

  it('rejects a blank name', async () => {
    const useCase = new CreateProjectUseCase(new FakeProjectRepository());
    await expect(useCase.execute({ name: '   ', templateName: 't', templateContent: {} })).rejects.toThrow(
      'Project name is required'
    );
  });

  it('rejects a missing template name', async () => {
    const useCase = new CreateProjectUseCase(new FakeProjectRepository());
    await expect(useCase.execute({ name: 'P', templateName: '', templateContent: {} })).rejects.toThrow(
      'Template name is required'
    );
  });
});
