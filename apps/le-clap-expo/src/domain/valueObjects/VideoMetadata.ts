/**
 * Value Object: VideoMetadata
 * Represents metadata about a recorded video
 */

export class VideoMetadata {
  constructor(
    public readonly path: string,
    public readonly orientation?: 'portrait' | 'landscape',
    public readonly duration?: number,
    public readonly width?: number,
    public readonly height?: number,
    public readonly recordedAt: Date = new Date()
  ) {}

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
    };
  }

  /**
   * Create from plain object
   */
  static fromJSON(data: unknown): VideoMetadata {
    const record = data as Record<string, unknown>;
    return new VideoMetadata(
      record.path as string,
      record.orientation as 'portrait' | 'landscape' | undefined,
      record.duration as number | undefined,
      record.width as number | undefined,
      record.height as number | undefined,
      record.recordedAt ? new Date(record.recordedAt as string) : new Date()
    );
  }
}
