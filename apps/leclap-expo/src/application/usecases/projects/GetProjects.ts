/**
 * Use Case: GetProjects
 * Handles the business logic for retrieving projects
 */

import type { Project } from '@/src/domain/entities/Project';
import type { IProjectRepository } from '@/src/domain/repositories/IProjectRepository';

export class GetProjectsUseCase {
  constructor(private readonly projectRepository: IProjectRepository) {}

  /**
   * Get all projects sorted by creation date
   */
  async execute(): Promise<Project[]> {
    const projects = await this.projectRepository.findAll();

    // Business logic: Sort projects by creation date (newest first)
    return [...projects].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get a single project by ID
   */
  async getById(id: string): Promise<Project | null> {
    if (!id) {
      throw new Error('Project ID is required');
    }

    return await this.projectRepository.findById(id);
  }

  /**
   * Get projects by status
   */
  async getByStatus(status: string): Promise<Project[]> {
    const projects = await this.projectRepository.findByStatus(status);

    return [...projects].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
