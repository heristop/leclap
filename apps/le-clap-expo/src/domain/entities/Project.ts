/**
 * Domain Entity: Project
 * Core business object representing a video project
 * This is independent of any framework or external concerns
 */

import { ProjectStatus } from '../valueObjects/ProjectStatus';
import { VideoMetadata } from '../valueObjects/VideoMetadata';

export class Project {
  constructor(
    public readonly id: string,
    public name: string,
    public templateName: string,
    public templateContent: Record<string, unknown>,
    public status: ProjectStatus,
    public formData: Record<string, unknown>,
    public recordedVideos: Record<string, VideoMetadata>,
    public readonly createdAt: Date,
    public updatedAt: Date,
    public outputVideoUri?: string,
    public thumbnailUri?: string
  ) {}

  /**
   * Business logic: Check if project is ready for compilation
   */
  isReadyForCompilation(): boolean {
    return this.status === ProjectStatus.DRAFT && Object.keys(this.recordedVideos).length > 0;
  }

  /**
   * Business logic: Check if project is completed
   */
  isCompleted(): boolean {
    return this.status === ProjectStatus.COMPLETED && !!this.outputVideoUri;
  }

  /**
   * Business logic: Update project status
   */
  updateStatus(newStatus: ProjectStatus): void {
    this.status = newStatus;
    this.updatedAt = new Date();
  }

  /**
   * Business logic: Add a recorded video
   */
  addRecordedVideo(sectionName: string, metadata: VideoMetadata): void {
    this.recordedVideos[sectionName] = metadata;
    this.updatedAt = new Date();
  }

  /**
   * Business logic: Update form data
   */
  updateFormData(field: string, value: unknown): void {
    this.formData[field] = value;
    this.updatedAt = new Date();
  }

  /**
   * Factory method to create a new project
   */
  static create(
    name: string,
    templateName: string,
    templateContent: Record<string, unknown>,
    options: {
      id?: string;
      status?: ProjectStatus;
      formData?: Record<string, unknown>;
      recordedVideos?: Record<string, VideoMetadata>;
      outputVideoUri?: string;
      thumbnailUri?: string;
      createdAt?: Date;
      updatedAt?: Date;
    } = {}
  ): Project {
    const {
      id,
      status = ProjectStatus.DRAFT,
      formData = {},
      recordedVideos = {},
      outputVideoUri,
      thumbnailUri,
      createdAt,
      updatedAt,
    } = options;

    const createdAtValue = createdAt ?? new Date();
    const updatedAtValue = updatedAt ?? createdAtValue;

    return new Project(
      id ?? Date.now().toString(),
      name,
      templateName,
      templateContent,
      status,
      formData,
      recordedVideos,
      createdAtValue,
      updatedAtValue,
      outputVideoUri,
      thumbnailUri
    );
  }

  /**
   * Convert to plain object for persistence
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      templateName: this.templateName,
      templateContent: this.templateContent,
      status: this.status,
      formData: this.formData,
      recordedVideos: Object.entries(this.recordedVideos).reduce(
        (acc, [key, value]) => ({
          ...acc,
          [key]: value.toJSON(),
        }),
        {}
      ),
      outputVideoUri: this.outputVideoUri,
      thumbnailUri: this.thumbnailUri,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  /**
   * Create from plain object
   */
  static fromJSON(data: Record<string, unknown>): Project {
    return new Project(
      data.id as string,
      data.name as string,
      data.templateName as string,
      (data.templateContent as Record<string, unknown>) || {},
      data.status as ProjectStatus,
      (data.formData as Record<string, unknown>) || {},
      Object.entries((data.recordedVideos as Record<string, unknown>) || {}).reduce(
        (acc, [key, value]: [string, unknown]) => ({
          ...acc,
          [key]: VideoMetadata.fromJSON(value),
        }),
        {}
      ),
      new Date(data.createdAt as string),
      new Date(data.updatedAt as string),
      data.outputVideoUri as string | undefined,
      data.thumbnailUri as string | undefined
    );
  }
}
