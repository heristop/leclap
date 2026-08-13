// Turning a drop event into a file list. react-dropzone delegated this to `file-selector`, which
// walked `dataTransfer.items` with `webkitGetAsEntry()` so a dropped FOLDER yielded the clips inside
// it. `dataTransfer.files` on its own reports a directory as one entry with no extension and an empty
// `type`, which every accept spec rejects — so without this a dropped folder of takes fails outright
// with "isn't a video we can read".

// lib.dom models FileSystemEntry with `isFile`/`isDirectory` booleans rather than a discriminated
// union, so the two narrowings below have to trust those flags.
const asFile = (entry: FileSystemEntry): FileSystemFileEntry | null =>
  entry.isFile ? (entry as FileSystemFileEntry) : null;

const asDirectory = (entry: FileSystemEntry): FileSystemDirectoryEntry | null =>
  entry.isDirectory ? (entry as FileSystemDirectoryEntry) : null;

const fileOf = (entry: FileSystemFileEntry): Promise<File | null> =>
  new Promise((resolve) => {
    entry.file(
      (file) => {
        resolve(file);
      },
      () => {
        resolve(null);
      }
    );
  });

// readEntries hands back at most 100 children per call and signals the end with an empty batch, so
// it has to be drained in a loop rather than read once.
const childrenOf = (directory: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> =>
  new Promise((resolve) => {
    const reader = directory.createReader();
    const found: FileSystemEntry[] = [];

    const drain = (): void => {
      reader.readEntries(
        (batch) => {
          if (batch.length === 0) {
            resolve(found);

            return;
          }

          found.push(...batch);
          drain();
        },
        () => {
          resolve(found);
        }
      );
    };

    drain();
  });

const walk = async (entry: FileSystemEntry): Promise<File[]> => {
  const file = asFile(entry);

  if (file) {
    const resolved = await fileOf(file);

    return resolved ? [resolved] : [];
  }

  const directory = asDirectory(entry);

  if (!directory) return [];

  const nested = await Promise.all((await childrenOf(directory)).map(walk));

  return nested.flat();
};

/**
 * Every file a drop carries, directories expanded.
 *
 * `entries` must be snapshotted SYNCHRONOUSLY by the caller: a DataTransfer is neutered the moment
 * the event handler yields, so `webkitGetAsEntry()` has to run before the first await. `fallback` is
 * the plain `dataTransfer.files` list, returned as-is when nothing was a directory and whenever the
 * walk fails — so a browser without the entry API behaves exactly as it did before.
 */
export const expandDroppedEntries = async (
  entries: readonly (FileSystemEntry | null)[],
  fallback: File[]
): Promise<File[]> => {
  if (!entries.some((entry) => entry?.isDirectory)) return fallback;

  try {
    const walked = await Promise.all(entries.filter((entry) => entry !== null).map(walk));
    const files = walked.flat();

    return files.length > 0 ? files : fallback;
  } catch {
    return fallback;
  }
};
