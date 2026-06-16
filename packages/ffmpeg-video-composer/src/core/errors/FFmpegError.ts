import { BaseError } from './BaseError';

export class FFmpegError extends BaseError {
  constructor(
    message: string,
    public readonly stderr?: string
  ) {
    super(message);

    if (stderr) {
      this.message += `\n--- FFmpeg stderr ---\n${stderr}`;
    }
  }
}
