import { ProjectRepository } from '@/src/infrastructure/repositories/ProjectRepository';
import { CreateProjectUseCase } from '@/src/application/usecases/projects/CreateProject';
import { GetProjectsUseCase } from '@/src/application/usecases/projects/GetProjects';
import { UpdateProjectUseCase } from '@/src/application/usecases/projects/UpdateProject';
import { DeleteProjectUseCase } from '@/src/application/usecases/projects/DeleteProject';

class Container {
  private readonly projectRepository: ProjectRepository;
  private readonly createProjectUseCase: CreateProjectUseCase;
  private readonly getProjectsUseCase: GetProjectsUseCase;
  private readonly updateProjectUseCase: UpdateProjectUseCase;
  private readonly deleteProjectUseCase: DeleteProjectUseCase;

  constructor() {
    this.projectRepository = new ProjectRepository();
    this.createProjectUseCase = new CreateProjectUseCase(this.projectRepository);
    this.getProjectsUseCase = new GetProjectsUseCase(this.projectRepository);
    this.updateProjectUseCase = new UpdateProjectUseCase(this.projectRepository);
    this.deleteProjectUseCase = new DeleteProjectUseCase(this.projectRepository);
  }

  getProjectRepository(): ProjectRepository {
    return this.projectRepository;
  }

  getCreateProjectUseCase(): CreateProjectUseCase {
    return this.createProjectUseCase;
  }

  getGetProjectsUseCase(): GetProjectsUseCase {
    return this.getProjectsUseCase;
  }

  getUpdateProjectUseCase(): UpdateProjectUseCase {
    return this.updateProjectUseCase;
  }

  getDeleteProjectUseCase(): DeleteProjectUseCase {
    return this.deleteProjectUseCase;
  }
}

export const container = new Container();
