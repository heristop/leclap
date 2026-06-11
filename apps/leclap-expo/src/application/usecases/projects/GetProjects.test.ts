import { GetProjectsUseCase } from './GetProjects';
import { Project } from '@/src/domain/entities/Project';
import { ProjectStatus } from '@/src/domain/valueObjects/ProjectStatus';
import { FakeProjectRepository } from '@/src/test-utils/FakeProjectRepository';

const projectAt = (id: string, iso: string, status = ProjectStatus.DRAFT) =>
  Project.create('P', 'portrait.json', {}, { id, status, createdAt: new Date(iso) });

describe('GetProjectsUseCase.execute', () => {
  it('returns all projects sorted newest-first', async () => {
    const repo = new FakeProjectRepository([
      projectAt('old', '2026-01-01T00:00:00.000Z'),
      projectAt('new', '2026-03-01T00:00:00.000Z'),
      projectAt('mid', '2026-02-01T00:00:00.000Z'),
    ]);
    const useCase = new GetProjectsUseCase(repo);

    const result = await useCase.execute();

    expect(result.map((p) => p.id)).toEqual(['new', 'mid', 'old']);
  });

  it('does not mutate the repository order (returns a sorted copy)', async () => {
    const repo = new FakeProjectRepository([
      projectAt('a', '2026-01-01T00:00:00.000Z'),
      projectAt('b', '2026-02-01T00:00:00.000Z'),
    ]);
    const useCase = new GetProjectsUseCase(repo);

    await useCase.execute();
    const raw = await repo.findAll();

    expect(raw.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('returns an empty array when there are no projects', async () => {
    const useCase = new GetProjectsUseCase(new FakeProjectRepository());
    expect(await useCase.execute()).toEqual([]);
  });
});

describe('GetProjectsUseCase.getById', () => {
  it('throws when the id is empty', async () => {
    const useCase = new GetProjectsUseCase(new FakeProjectRepository());
    await expect(useCase.getById('')).rejects.toThrow('Project ID is required');
  });

  it('returns the matching project or null', async () => {
    const repo = new FakeProjectRepository([projectAt('x', '2026-01-01T00:00:00.000Z')]);
    const useCase = new GetProjectsUseCase(repo);

    expect((await useCase.getById('x'))?.id).toBe('x');
    expect(await useCase.getById('missing')).toBeNull();
  });
});

describe('GetProjectsUseCase.getByStatus', () => {
  it('filters by status and sorts newest-first', async () => {
    const repo = new FakeProjectRepository([
      projectAt('d1', '2026-01-01T00:00:00.000Z', ProjectStatus.DRAFT),
      projectAt('done', '2026-02-01T00:00:00.000Z', ProjectStatus.COMPLETED),
      projectAt('d2', '2026-03-01T00:00:00.000Z', ProjectStatus.DRAFT),
    ]);
    const useCase = new GetProjectsUseCase(repo);

    const drafts = await useCase.getByStatus(ProjectStatus.DRAFT);

    expect(drafts.map((p) => p.id)).toEqual(['d2', 'd1']);
  });
});
