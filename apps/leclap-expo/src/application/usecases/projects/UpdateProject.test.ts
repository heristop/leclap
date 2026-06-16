import { UpdateProjectUseCase } from './UpdateProject';
import { Project } from '@/src/domain/entities/Project';
import { VideoMetadata } from '@/src/domain/valueObjects/VideoMetadata';
import { FakeProjectRepository } from '@/src/test-utils/FakeProjectRepository';

const seedProject = () => Project.create('Original', 'portrait.json', { v: 1 }, { id: 'p1', formData: { a: '1' } });

describe('UpdateProjectUseCase', () => {
  it('updates provided fields and persists', async () => {
    const repo = new FakeProjectRepository([seedProject()]);
    const useCase = new UpdateProjectUseCase(repo);

    const updated = await useCase.execute({
      id: 'p1',
      name: 'Renamed',
      templateContent: { v: 2 },
      outputVideoUri: '/out.mp4',
      thumbnailUri: '/t.jpg',
    });

    expect(updated.name).toBe('Renamed');
    expect(updated.templateContent).toEqual({ v: 2 });
    expect(updated.outputVideoUri).toBe('/out.mp4');
    expect(updated.thumbnailUri).toBe('/t.jpg');
    expect((await repo.findById('p1'))?.name).toBe('Renamed');
  });

  it('merges formData and recordedVideos rather than replacing the project', async () => {
    const repo = new FakeProjectRepository([seedProject()]);
    const useCase = new UpdateProjectUseCase(repo);

    const updated = await useCase.execute({
      id: 'p1',
      formData: { b: '2' },
      recordedVideos: { video_1: new VideoMetadata({ path: '/v.mp4', crop: { x: 0, y: 0, w: 0.5, h: 0.5 } }) },
    });

    expect(updated.formData).toEqual({ a: '1', b: '2' });
    expect(updated.recordedVideos.video_1.crop).toEqual({ x: 0, y: 0, w: 0.5, h: 0.5 });
  });

  it('leaves untouched fields unchanged', async () => {
    const repo = new FakeProjectRepository([seedProject()]);
    const useCase = new UpdateProjectUseCase(repo);

    const updated = await useCase.execute({ id: 'p1' });

    expect(updated.name).toBe('Original');
    expect(updated.templateContent).toEqual({ v: 1 });
  });

  it('throws when the project does not exist', async () => {
    const useCase = new UpdateProjectUseCase(new FakeProjectRepository());
    await expect(useCase.execute({ id: 'missing', name: 'X' })).rejects.toThrow('Project not found');
  });
});
