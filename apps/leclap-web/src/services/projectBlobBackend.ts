import { ProjectBlobStore, type BlobBackend, type BlobRecord } from './projectBlobStore';

// Separate DB from `leclap-media` so a project's clip/output bytes have their own lifecycle
// (deleting a project purges only its blobs, never the user's uploaded media library).
const DB_NAME = 'leclap-projects';
const STORE = 'blobs';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(new Error(request.error?.message ?? 'project blob db open failed'));
    };
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = run(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => {
          resolve(request.result);
        };
        request.onerror = () => {
          reject(new Error(request.error?.message ?? 'project blob db op failed'));
        };
      })
  );
}

const indexedDbBackend: BlobBackend = {
  put: async (record) => {
    await tx('readwrite', (store) => store.put(record));
  },
  get: async (key) =>
    (await tx<BlobRecord | undefined>('readonly', (store) => store.get(key) as IDBRequest<BlobRecord | undefined>)) ??
    null,
  delete: async (key) => {
    await tx('readwrite', (store) => store.delete(key));
  },
};

export const projectBlobStore = new ProjectBlobStore(indexedDbBackend);
