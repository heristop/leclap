/**
 * Use Case: CreateProject
 * Handles the business logic for creating a new project
 */

import { Project } from '@/src/domain/entities/Project';
import { IProjectRepository } from '@/src/domain/repositories/IProjectRepository';
import { ProjectStatus } from '@/src/domain/valueObjects/ProjectStatus';
import { VideoMetadata } from '@/src/domain/valueObjects/VideoMetadata';

export interface CreateProjectDTO {
  id?: string;
  name: string;
  templateName: string;
  templateContent: Record<string, unknown>;
  status?: ProjectStatus;
  formData?: Record<string, unknown>;
  recordedVideos?: Record<string, VideoMetadata>;
  outputVideoUri?: string;
  thumbnailUri?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class CreateProjectUseCase {
  constructor(private readonly projectRepository: IProjectRepository) {}

  async execute(data: CreateProjectDTO): Promise<Project> {
    // Business rule validation
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Project name is required');
    }

    if (!data.templateName) {
      throw new Error('Template name is required');
    }

    // Create new project using factory method
    const project = Project.create(data.name, data.templateName, data.templateContent, {
      id: data.id,
      status: data.status,
      formData: data.formData,
      recordedVideos: data.recordedVideos,
      outputVideoUri: data.outputVideoUri,
      thumbnailUri: data.thumbnailUri,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });

    // Persist the project
    return await this.projectRepository.save(project);
  }
}
