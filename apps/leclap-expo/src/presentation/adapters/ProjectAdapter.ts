import type { Project } from '@/src/domain/entities/Project';
import { container } from '@/src/infrastructure/di/Container';
import type { CreateProjectDTO } from '@/src/application/usecases/projects/CreateProject';
import type { UpdateProjectDTO } from '@/src/application/usecases/projects/UpdateProject';
import { VideoMetadata } from '@/src/domain/valueObjects/VideoMetadata';

export class ProjectAdapter {
  private readonly createProjectUseCase = container.getCreateProjectUseCase();
  private readonly getProjectsUseCase = container.getGetProjectsUseCase();
  private readonly updateProjectUseCase = container.getUpdateProjectUseCase();
  private readonly deleteProjectUseCase = container.getDeleteProjectUseCase();

  async getAllProjects(): Promise<Project[]> {
    return this.getProjectsUseCase.execute();
  }

  async getProjectById(id: string): Promise<Project | null> {
    return this.getProjectsUseCase.getById(id);
  }

  async getProjectsByStatus(status: string): Promise<Project[]> {
    return this.getProjectsUseCase.getByStatus(status);
  }

  async createProject(
    data: CreateProjectDTO & {
      recordedVideos?: Record<
        string,
        {
          path: string;
          orientation?: string;
          duration?: number;
          width?: number;
          height?: number;
          recordedAt?: string;
          trim?: { start: number; end: number };
          crop?: { x: number; y: number; w: number; h: number };
        }
      >;
      createdAt?: string | Date;
      updatedAt?: string | Date;
    }
  ): Promise<Project> {
    const createData: CreateProjectDTO = {
      ...data,
      createdAt: typeof data.createdAt === 'string' ? new Date(data.createdAt) : data.createdAt,
      updatedAt: typeof data.updatedAt === 'string' ? new Date(data.updatedAt) : data.updatedAt,
      recordedVideos: data.recordedVideos
        ? Object.fromEntries(
            Object.entries(data.recordedVideos).map(([key, value]) => [
              key,
              new VideoMetadata({
                path: value.path,
                orientation: value.orientation,
                duration: value.duration,
                width: value.width,
                height: value.height,
                recordedAt: value.recordedAt ? new Date(value.recordedAt) : new Date(),
                trim: value.trim,
                crop: value.crop,
              }),
            ])
          )
        : undefined,
    };

    return this.createProjectUseCase.execute(createData);
  }

  async updateProject(
    data: UpdateProjectDTO & {
      templateContent?: Record<string, unknown>;
      recordedVideos?: Record<
        string,
        {
          path: string;
          orientation?: string;
          duration?: number;
          width?: number;
          height?: number;
          recordedAt?: string;
          trim?: { start: number; end: number };
          crop?: { x: number; y: number; w: number; h: number };
        }
      >;
      thumbnailUri?: string;
    }
  ): Promise<Project> {
    const updateData: UpdateProjectDTO = {
      ...data,
      templateContent: data.templateContent,
      recordedVideos: data.recordedVideos
        ? Object.fromEntries(
            Object.entries(data.recordedVideos).map(([key, value]) => [
              key,
              new VideoMetadata({
                path: value.path,
                orientation: value.orientation,
                duration: value.duration,
                width: value.width,
                height: value.height,
                recordedAt: value.recordedAt ? new Date(value.recordedAt) : new Date(),
                trim: value.trim,
                crop: value.crop,
              }),
            ])
          )
        : undefined,
      thumbnailUri: data.thumbnailUri,
    };

    return this.updateProjectUseCase.execute(updateData);
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.deleteProjectUseCase.execute(projectId);
  }

  async deleteAllProjects(): Promise<void> {
    await this.deleteProjectUseCase.deleteAll();
  }
}

export const projectAdapter = new ProjectAdapter();
