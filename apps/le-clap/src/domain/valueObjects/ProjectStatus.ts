/**
 * Value Object: ProjectStatus
 * Represents the possible states of a project
 */

export enum ProjectStatus {
  DRAFT = 'draft',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export class ProjectStatusHelper {
  static canTransitionTo(currentStatus: ProjectStatus, newStatus: ProjectStatus): boolean {
    const transitions: Record<ProjectStatus, ProjectStatus[]> = {
      [ProjectStatus.DRAFT]: [ProjectStatus.PROCESSING],
      [ProjectStatus.PROCESSING]: [ProjectStatus.COMPLETED, ProjectStatus.FAILED],
      [ProjectStatus.COMPLETED]: [ProjectStatus.DRAFT], // Allow re-editing
      [ProjectStatus.FAILED]: [ProjectStatus.DRAFT, ProjectStatus.PROCESSING], // Allow retry
    };

    return transitions[currentStatus]?.includes(newStatus) ?? false;
  }

  static isTerminal(status: ProjectStatus): boolean {
    return status === ProjectStatus.COMPLETED || status === ProjectStatus.FAILED;
  }
}
