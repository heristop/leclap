import { Project as DomainProject } from '@/src/domain/entities/Project';
import type { Project as UIProject, TemplateDescriptor } from '@/src/types';
import { VideoMetadata } from '@/src/domain/valueObjects/VideoMetadata';
import { ProjectStatus } from '@/src/domain/valueObjects/ProjectStatus';

/**
 * Mapper to convert between domain entities and UI types
 */
export class ProjectMapper {
  /**
   * Convert domain Project entity to UI Project interface
   */
  static toUI(domainProject: InstanceType<typeof DomainProject>): UIProject {
    // Convert VideoMetadata instances to plain objects
    const recordedVideos: Record<
      string,
      {
        path: string;
        orientation: 'portrait' | 'landscape';
        duration?: number;
        fileSize?: number;
        trim?: { start: number; end: number };
        crop?: { x: number; y: number; w: number; h: number };
      }
    > = {};

    for (const [key, metadata] of Object.entries(domainProject.recordedVideos)) {
      recordedVideos[key] = {
        path: metadata.path,
        orientation: metadata.orientation ?? 'portrait',
        duration: metadata.duration,
        fileSize: undefined, // VideoMetadata doesn't have fileSize
        trim: metadata.trim,
        crop: metadata.crop,
      };
    }

    return {
      id: domainProject.id,
      name: domainProject.name,
      templateName: domainProject.templateName,
      templateContent: domainProject.templateContent as TemplateDescriptor,
      status: domainProject.status as 'draft' | 'processing' | 'completed' | 'failed',
      formData: domainProject.formData,
      recordedVideos,
      outputVideoUri: domainProject.outputVideoUri,
      thumbnailUri: domainProject.thumbnailUri ?? null,
      createdAt: domainProject.createdAt.toISOString(),
      updatedAt: domainProject.updatedAt.toISOString(),
    };
  }

  /**
   * Convert UI Project interface to domain Project entity
   */
  static toDomain(uiProject: UIProject): InstanceType<typeof DomainProject> {
    // Convert plain objects to VideoMetadata instances
    const recordedVideos: Record<string, InstanceType<typeof VideoMetadata>> = {};

    for (const [key, value] of Object.entries(uiProject.recordedVideos)) {
      recordedVideos[key] = new VideoMetadata({
        path: value.path,
        orientation: value.orientation,
        duration: value.duration,
        trim: value.trim,
        crop: value.crop,
      });
    }

    // Convert status string to ProjectStatus enum
    const statusMap: Partial<Record<string, ProjectStatus>> = {
      draft: ProjectStatus.DRAFT,
      processing: ProjectStatus.PROCESSING,
      completed: ProjectStatus.COMPLETED,
      failed: ProjectStatus.FAILED,
    };
    const domainStatus = statusMap[uiProject.status] ?? ProjectStatus.DRAFT;

    return new DomainProject({
      id: uiProject.id,
      name: uiProject.name,
      templateName: uiProject.templateName,
      templateContent: uiProject.templateContent as Record<string, unknown>,
      status: domainStatus,
      formData: uiProject.formData,
      recordedVideos,
      createdAt: new Date(uiProject.createdAt),
      updatedAt: new Date(uiProject.updatedAt),
      outputVideoUri: uiProject.outputVideoUri,
      thumbnailUri: uiProject.thumbnailUri ?? undefined,
    });
  }

  /**
   * Convert array of domain Projects to UI Projects
   */
  static toUIArray(domainProjects: InstanceType<typeof DomainProject>[]): UIProject[] {
    return domainProjects.map((project) => ProjectMapper.toUI(project));
  }
}
