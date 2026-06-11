/**
 * Use Case: UpdateProject
 * Handles the business logic for updating a project
 */

import type { Project } from '@/src/domain/entities/Project';
import type { IProjectRepository } from '@/src/domain/repositories/IProjectRepository';
import type { VideoMetadata } from '@/src/domain/valueObjects/VideoMetadata';

export interface UpdateProjectDTO {
  id: string;
  name?: string;
  templateContent?: Record<string, unknown>;
  formData?: Record<string, unknown>;
  recordedVideos?: Record<string, VideoMetadata>;
  outputVideoUri?: string;
  thumbnailUri?: string;
}

export class UpdateProjectUseCase {
  constructor(private readonly projectRepository: IProjectRepository) {}

  async execute(data: UpdateProjectDTO): Promise<Project> {
    // Find existing project
    const project = await this.projectRepository.findById(data.id);

    if (!project) {
      throw new Error('Project not found');
    }

    // Update fields if provided
    if (data.name !== undefined) {
      project.name = data.name;
    }

    if (data.templateContent !== undefined) {
      project.templateContent = data.templateContent;
    }

    if (data.formData !== undefined) {
      for (const [key, value] of Object.entries(data.formData)) {
        project.updateFormData(key, value);
      }
    }

    if (data.recordedVideos !== undefined) {
      for (const [key, value] of Object.entries(data.recordedVideos)) {
        project.addRecordedVideo(key, value);
      }
    }

    if (data.outputVideoUri !== undefined) {
      project.outputVideoUri = data.outputVideoUri;
    }

    if (data.thumbnailUri !== undefined) {
      project.thumbnailUri = data.thumbnailUri;
    }

    // Update timestamp
    project.updatedAt = new Date();

    // Save updated project
    return await this.projectRepository.save(project);
  }
}
