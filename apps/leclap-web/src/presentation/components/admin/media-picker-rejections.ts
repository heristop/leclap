import type { TFunction } from 'i18next';
import type { Rejection, RejectionCode } from '@/lib/upload/core/types';

// Most specific first: a file that is both the wrong type and oversized is most usefully described
// by its type, and one file should produce one line rather than one per failed check.
const PRIORITY: RejectionCode[] = ['file-invalid-type', 'file-too-large', 'too-many-files'];

const KEY: Record<RejectionCode, string> = {
  'file-invalid-type': 'media.rejectInvalidType',
  'file-too-large': 'media.rejectTooLarge',
  'too-many-files': 'media.rejectTooMany',
};

/**
 * One translated line per rejected file. The accepted-formats list is passed in (derived by
 * `describeAccept`) rather than written into the copy, so the message names exactly what the drop
 * surface would have taken.
 */
export function rejectionMessages(rejections: Rejection[], t: TFunction<'admin'>, formats: string): string[] {
  return rejections.map((rejection) => {
    const codes = new Set(rejection.errors.map((error) => error.code));
    const code = PRIORITY.find((candidate) => codes.has(candidate)) ?? 'file-invalid-type';
    const name = rejection.file.name;

    if (code === 'file-invalid-type') {
      return t(KEY[code], { name, formats });
    }

    return t(KEY[code], { name });
  });
}
