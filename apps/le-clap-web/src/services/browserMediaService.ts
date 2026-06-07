import { BrowserMediaStore, type MediaBackend, type MediaRecord } from '@/stores/browserMediaStore'

const DB_NAME = 'leclap-media'
const STORE = 'media'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result

      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => { resolve(request.result) }
    request.onerror = () => { reject(new Error(request.error?.message ?? 'media db open failed')) }
  })
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const request = run(db.transaction(STORE, mode).objectStore(STORE))
    request.onsuccess = () => { resolve(request.result) }
    request.onerror = () => { reject(new Error(request.error?.message ?? 'media db op failed')) }
  }))
}

const indexedDbBackend: MediaBackend = {
  put: async (record) => { await tx('readwrite', (s) => s.put(record)) },
  get: async (key) => (await tx<MediaRecord | undefined>('readonly', (s) => s.get(key) as IDBRequest<MediaRecord | undefined>)) ?? null,
  delete: async (key) => { await tx('readwrite', (s) => s.delete(key)) },
}

export const browserMediaService = new BrowserMediaStore(indexedDbBackend)
