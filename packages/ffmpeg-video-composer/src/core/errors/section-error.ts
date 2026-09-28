import { BaseError } from './BaseError';

// A section that failed to build or render. Carries the section name and the underlying cause so a
// caller can say which section broke and why, instead of receiving a video with that section missing.
export class SectionError extends BaseError {
  constructor(
    public readonly section: string,
    cause: unknown
  ) {
    super(`Section "${section}" failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.cause = cause;
  }
}
