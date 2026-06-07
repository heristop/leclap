import { DeleteProjectUseCase } from './DeleteProject';
import { Project } from '@/src/domain/entities/Project';
import { FakeProjectRepository } from '@/src/test-utils/FakeProjectRepository';

const seed = () => Project.create('P', 'portrait.json', {}, { id: 'p1' });

describe('DeleteProjectUseCase.execute', () => {
  it('deletes an existing project', async () => {
    const repo = new FakeProjectRepository([seed()]);
    const useCase = new DeleteProjectUseCase(repo);

    await useCase.execute('p1');

    expect(repo.has('p1')).toBe(false);
    expect(repo.count()).toBe(0);
  });

  it('throws when the id is empty', async () => {
    const useCase = new DeleteProjectUseCase(new FakeProjectRepository());
    await expect(useCase.execute('')).rejects.toThrow('Project ID is required');
  });

  it('throws when the project does not exist', async () => {
    const useCase = new DeleteProjectUseCase(new FakeProjectRepository());
    await expect(useCase.execute('missing')).rejects.toThrow('Project not found');
  });
});

describe('DeleteProjectUseCase.deleteAll', () => {
  it('clears every project', async () => {
    const repo = new FakeProjectRepository([
      seed(),
      Project.create('P2', 'portrait.json', {}, { id: 'p2' }),
    ]);
    const useCase = new DeleteProjectUseCase(repo);

    await useCase.deleteAll();

    expect(repo.count()).toBe(0);
  });
});
