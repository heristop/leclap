/**
 * Value Object: VideoMetadata
 * Represents metadata about a recorded video
 */

/** Trim selection in seconds. */
export interface VideoTrim {
  start: number;
  end: number;
}

/** Crop selection normalized to the source frame (0..1), resolution-independent. */
export interface VideoCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface VideoMetadataParams {
  path: string;
  orientation?: 'portrait' | 'landscape';
  duration?: number;
  width?: number;
  height?: number;
  recordedAt?: Date;
  trim?: VideoTrim;
  crop?: VideoCrop;
}

export class VideoMetadata {
  public readonly path: string;
  public readonly orientation?: 'portrait' | 'landscape';
  public readonly duration?: number;
  public readonly width?: number;
  public readonly height?: number;
  public readonly recordedAt: Date;
  public readonly trim?: VideoTrim;
  public readonly crop?: VideoCrop;

  constructor(params: VideoMetadataParams) {
    this.path = params.path;
    this.orientation = params.orientation;
    this.duration = params.duration;
    this.width = params.width;
    this.height = params.height;
    this.recordedAt = params.recordedAt ?? new Date();
    this.trim = params.trim;
    this.crop = params.crop;
  }

  /**
   * Check if video has valid dimensions
   */
  hasValidDimensions(): boolean {
    return (this.width ?? 0) > 0 && (this.height ?? 0) > 0;
  }

  /**
   * Get aspect ratio
   */
  getAspectRatio(): number | null {
    if (!this.hasValidDimensions()) return null;

    return (this.width ?? 0) / (this.height ?? 1);
  }

  /**
   * Check if video is portrait
   */
  isPortrait(): boolean {
    const ratio = this.getAspectRatio();

    return ratio !== null && ratio < 1;
  }

  /**
   * Convert to plain object
   */
  toJSON(): Record<string, unknown> {
    return {
      path: this.path,
      orientation: this.orientation,
      duration: this.duration,
      width: this.width,
      height: this.height,
      recordedAt: this.recordedAt.toISOString(),
      trim: this.trim,
      crop: this.crop,
    };
  }

  /**
   * Create from plain object
   */
  static fromJSON(data: unknown): VideoMetadata {
    const record = data as Record<string, unknown>;

    return new VideoMetadata({
      path: record.path as string,
      orientation: record.orientation as 'portrait' | 'landscape' | undefined,
      duration: record.duration as number | undefined,
      width: record.width as number | undefined,
      height: record.height as number | undefined,
      recordedAt: record.recordedAt ? new Date(record.recordedAt as string) : new Date(),
      trim: record.trim as VideoTrim | undefined,
      crop: record.crop as VideoCrop | undefined,
    });
  }
}
