/**
 * Use Case: DeleteProject
 * Handles the business logic for deleting projects
 */

import type { IProjectRepository } from '@/src/domain/repositories/IProjectRepository';

export class DeleteProjectUseCase {
  constructor(private readonly projectRepository: IProjectRepository) {}

  /**
   * Delete a single project
   */
  async execute(projectId: string): Promise<void> {
    if (!projectId) {
      throw new Error('Project ID is required');
    }

    // Check if project exists
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Business rule: Could add checks here like:
    // - Can't delete if project is being processed
    // - Can't delete if project is locked
    // - etc.

    await this.projectRepository.delete(projectId);
  }

  /**
   * Delete all projects
   */
  async deleteAll(): Promise<void> {
    // Business rule: Could add confirmation logic or checks here
    await this.projectRepository.deleteAll();
  }
}
