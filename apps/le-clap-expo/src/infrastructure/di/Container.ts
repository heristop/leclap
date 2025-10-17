import { ProjectRepository } from '@/src/infrastructure/repositories/ProjectRepository';
import { CreateProjectUseCase } from '@/src/application/usecases/projects/CreateProject';
import { GetProjectsUseCase } from '@/src/application/usecases/projects/GetProjects';
import { UpdateProjectUseCase } from '@/src/application/usecases/projects/UpdateProject';
import { DeleteProjectUseCase } from '@/src/application/usecases/projects/DeleteProject';

class Container {
  private projectRepository: ProjectRepository;
  private createProjectUseCase: CreateProjectUseCase;
  private getProjectsUseCase: GetProjectsUseCase;
  private updateProjectUseCase: UpdateProjectUseCase;
  private deleteProjectUseCase: DeleteProjectUseCase;

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
