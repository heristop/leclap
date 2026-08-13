import type { AcceptSpec } from './types';

const isWildcard = (mime: string): boolean => mime.endsWith('/*');

// The <input accept> attribute. A wildcard contributes ONLY its MIME: pairing 'video/*' with
// extensions is what makes iOS and Android drop the Camera / Photo Library entries and fall back to
// a plain file browser. Concrete types have no such affordance to protect, so their extensions ride
// along and help browsers that don't know the type.
export const pickerAccept = (spec: AcceptSpec): string => {
  const tokens: string[] = [];

  for (const group of spec) {
    tokens.push(group.mime);

    if (isWildcard(group.mime)) continue;

    tokens.push(...group.extensions);
  }

  return [...new Set(tokens)].join(',');
};

const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.');

  if (dot === -1) return '';

  return name.slice(dot).toLowerCase();
};

const mimeMatches = (type: string, mime: string): boolean => {
  if (type === '') return false;

  if (!isWildcard(mime)) return type.toLowerCase() === mime.toLowerCase();

  return type.toLowerCase().startsWith(mime.slice(0, -1).toLowerCase());
};

// OR, deliberately: a file passes if its MIME matches the family OR its extension is listed. This is
// what react-dropzone v15 did, and a refactor must not change which files upload. The extension arm
// also covers Safari, which hands us an empty `file.type` for .mkv and some camera captures.
export const matches = (file: File, spec: AcceptSpec): boolean => {
  if (spec.length === 0) return true;

  const ext = extensionOf(file.name);

  for (const group of spec) {
    if (mimeMatches(file.type, group.mime)) return true;

    if (ext !== '' && group.extensions.some((candidate) => candidate.toLowerCase() === ext)) return true;
  }

  return false;
};
