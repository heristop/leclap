import { Project as DomainProject } from '@/src/domain/entities/Project';
import { Project as UIProject, TemplateDescriptor } from '@/src/types';
import { VideoMetadata } from '@/src/domain/valueObjects/VideoMetadata';

/**
 * Mapper to convert between domain entities and UI types
 */
export class ProjectMapper {
  /**
   * Convert domain Project entity to UI Project interface
   */
  static toUI(domainProject: DomainProject): UIProject {
    // Convert VideoMetadata instances to plain objects
    const recordedVideos: Record<
      string,
      {
        path: string;
        orientation: 'portrait' | 'landscape';
        duration?: number;
        fileSize?: number;
      }
    > = {};

    Object.entries(domainProject.recordedVideos).forEach(([key, metadata]) => {
      recordedVideos[key] = {
        path: metadata.path,
        orientation: metadata.orientation || 'portrait',
        duration: metadata.duration,
        fileSize: undefined, // VideoMetadata doesn't have fileSize
      };
    });

    return {
      id: domainProject.id,
      name: domainProject.name,
      templateName: domainProject.templateName,
      templateContent: domainProject.templateContent as TemplateDescriptor,
      status: domainProject.status as 'draft' | 'processing' | 'completed' | 'failed',
      formData: domainProject.formData,
      recordedVideos,
      outputVideoUri: domainProject.outputVideoUri,
      thumbnailUri: domainProject.thumbnailUri || null,
      createdAt: domainProject.createdAt.toISOString(),
      updatedAt: domainProject.updatedAt.toISOString(),
    };
  }

  /**
   * Convert UI Project interface to domain Project entity
   */
  static toDomain(uiProject: UIProject): DomainProject {
    // Convert plain objects to VideoMetadata instances
    const recordedVideos: Record<string, VideoMetadata> = {};

    Object.entries(uiProject.recordedVideos).forEach(([key, value]) => {
      recordedVideos[key] = new VideoMetadata(
        value.path,
        value.orientation,
        value.duration,
        undefined, // width
        undefined, // height
        new Date()
      );
    });

    return new DomainProject(
      uiProject.id,
      uiProject.name,
      uiProject.templateName,
      uiProject.templateContent as Record<string, unknown>,
      uiProject.status as any, // Will be converted to ProjectStatus enum
      uiProject.formData,
      recordedVideos,
      new Date(uiProject.createdAt),
      new Date(uiProject.updatedAt),
      uiProject.outputVideoUri,
      uiProject.thumbnailUri || undefined
    );
  }

  /**
   * Convert array of domain Projects to UI Projects
   */
  static toUIArray(domainProjects: DomainProject[]): UIProject[] {
    return domainProjects.map((project) => ProjectMapper.toUI(project));
  }
}
