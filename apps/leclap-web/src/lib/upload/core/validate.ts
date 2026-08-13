import { matches } from './accept';
import type { AcceptSpec, Rejection, RejectionCode } from './types';

export interface ValidateOptions {
  accept?: AcceptSpec;
  /** Bytes. */
  maxSize?: number;
  /** How many more files may be accepted. 0 means none — unlike react-dropzone, which read <1 as Infinity. */
  remaining?: number;
}

export interface ValidateResult {
  accepted: File[];
  rejections: Rejection[];
}

// Messages are developer-facing only; the UI translates from `code` via the upload.* i18n keys.
const MESSAGE: Record<RejectionCode, string> = {
  'file-too-large': 'File is larger than the permitted size',
  'file-invalid-type': 'File type is not accepted',
  'too-many-files': 'Too many files',
};

const reject = (file: File, codes: RejectionCode[]): Rejection => ({
  file,
  errors: codes.map((code) => ({ code, message: MESSAGE[code] })),
});

export const validateFiles = (files: File[], options: ValidateOptions = {}): ValidateResult => {
  const { accept = [], maxSize, remaining } = options;
  const accepted: File[] = [];
  const rejections: Rejection[] = [];

  for (const file of files) {
    const codes: RejectionCode[] = [];

    if (!matches(file, accept)) codes.push('file-invalid-type');

    if (maxSize !== undefined && file.size > maxSize) codes.push('file-too-large');

    if (codes.length > 0) {
      rejections.push(reject(file, codes));
      continue;
    }

    if (remaining !== undefined && accepted.length >= remaining) {
      rejections.push(reject(file, ['too-many-files']));
      continue;
    }

    accepted.push(file);
  }

  return { accepted, rejections };
};
