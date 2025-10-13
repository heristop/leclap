/**
 * Repository Interface: IProjectRepository
 * Defines the contract for project persistence
 * This interface belongs to the domain layer but is implemented in infrastructure
 */

import { Project } from '../entities/Project';

export interface IProjectRepository {
  /**
   * Save a project (create or update)
   */
  save(project: Project): Promise<Project>;

  /**
   * Find a project by ID
   */
  findById(id: string): Promise<Project | null>;

  /**
   * Get all projects
   */
  findAll(): Promise<Project[]>;

  /**
   * Delete a project by ID
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all projects
   */
  deleteAll(): Promise<void>;

  /**
   * Find projects by status
   */
  findByStatus(status: string): Promise<Project[]>;

  /**
   * Find projects by template
   */
  findByTemplate(templateName: string): Promise<Project[]>;
}
