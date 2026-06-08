/* eslint-env browser */
import { injectable } from 'tsyringe';
import AbstractFilesystem from './AbstractFilesystem';

interface FileData {
  name: string;
  data: Uint8Array;
  metadata: {
    size: number;
    type: string;
    lastModified: number;
    originalFile?: File;
  };
}

function getFileType(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'mp4':
    case 'avi':
    case 'mov':
    case 'mkv':
      return 'video';
    case 'mp3':
    case 'wav':
    case 'aac':
      return 'audio';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
      return 'image';
    case 'json':
      return 'application/json';
    case 'txt':
      return 'text/plain';
    default:
      return 'application/octet-stream';
  }
}

function dbRequest<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
  errorMessage: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], mode);
    const store = transaction.objectStore(storeName);
    const request = operation(store);

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(new Error(`${errorMessage}: ${request.error?.message}`));
    };
  });
}

async function estimateStorageUsage(): Promise<{ used: number; available?: number }> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();

      return {
        used: estimate.usage ?? 0,
        available: estimate.quota ? estimate.quota - (estimate.usage ?? 0) : undefined,
      };
    } catch (error) {
      console.warn('Failed to get storage estimate:', error);
    }
  }

  return { used: 0 };
}

@injectable()
class BrowserFilesystemAdapter extends AbstractFilesystem {
  private readonly dbName = 'le-clap-fs';
  private readonly dbVersion = 1;
  private readonly storeName = 'files';
  private db: IDBDatabase | null = null;
  private readonly initPromise: Promise<void> | null = null;

  constructor() {
    super();
    this.initPromise = this.initializeDB();
  }

  private async initializeDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'name' });
          store.createIndex('type', 'metadata.type', { unique: false });
          store.createIndex('lastModified', 'metadata.lastModified', { unique: false });
        }
      };
    });
  }

  private async ensureInitialized(): Promise<IDBDatabase> {
    if (this.initPromise) {
      await this.initPromise;
    }

    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    return this.db;
  }

  async read(path: string): Promise<string> {
    return new TextDecoder().decode(await this.readFile(path));
  }

  async write(targetPath: string, content?: string): Promise<void> {
    if (content === undefined) {
      if (!(await this.exists(targetPath))) {
        await this.writeFile(targetPath, new Uint8Array(0));
      }

      return;
    }

    await this.writeFile(targetPath, new TextEncoder().encode(content));
  }

  async readFile(path: string): Promise<Uint8Array> {
    const db = await this.ensureInitialized();
    const result = await dbRequest<FileData | undefined>(
      db,
      this.storeName,
      'readonly',
      (store) => store.get(path) as IDBRequest<FileData | undefined>,
      `Failed to read file ${path}`
    );

    if (!result) {
      throw new Error(`File not found: ${path}`);
    }

    return result.data;
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    const db = await this.ensureInitialized();

    const fileData: FileData = {
      name: path,
      data,
      metadata: {
        size: data.length,
        type: getFileType(path),
        lastModified: Date.now(),
      },
    };

    await dbRequest<IDBValidKey>(
      db,
      this.storeName,
      'readwrite',
      (store) => store.put(fileData),
      `Failed to write file ${path}`
    );
  }

  async exists(path: string): Promise<boolean> {
    const db = await this.ensureInitialized();
    const count = await dbRequest<number>(
      db,
      this.storeName,
      'readonly',
      (store) => store.count(path),
      `Failed to check existence of ${path}`
    ).catch(() => 0);

    return count > 0;
  }

  async ensureDir(_path: string): Promise<void> {
    // directories are virtual in IndexedDB — no physical creation needed
  }

  async copy(src: string, dest: string): Promise<void> {
    const data = await this.readFile(src);
    await this.writeFile(dest, data);
  }

  async remove(path: string): Promise<void> {
    const db = await this.ensureInitialized();
    await dbRequest(db, this.storeName, 'readwrite', (store) => store.delete(path), `Failed to remove file ${path}`);
  }

  async storeFile(file: File, path: string): Promise<void> {
    const data = new Uint8Array(await file.arrayBuffer());
    const db = await this.ensureInitialized();

    const fileData: FileData = {
      name: path,
      data,
      metadata: {
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        originalFile: file,
      },
    };

    await dbRequest<IDBValidKey>(
      db,
      this.storeName,
      'readwrite',
      (store) => store.put(fileData),
      `Failed to store file ${path}`
    );
  }

  async getFileMetadata(path: string): Promise<FileData['metadata'] | null> {
    const db = await this.ensureInitialized();
    const result = await dbRequest<FileData | undefined>(
      db,
      this.storeName,
      'readonly',
      (store) => store.get(path) as IDBRequest<FileData | undefined>,
      `Failed to get metadata for ${path}`
    );

    return result ? result.metadata : null;
  }

  async listFiles(): Promise<string[]> {
    const db = await this.ensureInitialized();

    return dbRequest<IDBValidKey[]>(
      db,
      this.storeName,
      'readonly',
      (store) => store.getAllKeys(),
      'Failed to list files'
    ) as Promise<string[]>;
  }

  async clear(): Promise<void> {
    const db = await this.ensureInitialized();
    await dbRequest(db, this.storeName, 'readwrite', (store) => store.clear(), 'Failed to clear files');
  }

  async getAssetsPath(dir: string): Promise<string> {
    return `/assets/${dir}`;
  }

  async getBuildPath(buildDir: string): Promise<string> {
    return this.buildDir ? `${this.buildDir}/${buildDir}` : `/tmp/build/${buildDir}`;
  }

  getSource(segmentName?: string): string {
    if (segmentName) {
      return `/tmp/${segmentName}`;
    }

    return this.segmentName ? `/tmp/${this.segmentName}` : '/tmp/default';
  }

  getDestination(): string {
    // Use the full build-dir path so it matches the concat list entries
    // (TemplateDirector.append builds `${buildDir}/${name}_output.mp4`) and the
    // final concat output. The WASM adapter creates the MEMFS parent directory
    // on demand before each command, so a nested path is safe.
    const dir = this.buildDir ?? '/tmp/build';

    return this.segmentName ? `${dir}/${this.segmentName}_output.mp4` : `${dir}/output.mp4`;
  }

  async stat(filePath: string): Promise<boolean> {
    return await this.exists(filePath);
  }

  async fetch(url: string): Promise<string> {
    // A local virtual path already in the store (an uploaded asset materialized
    // into the engine FS) is not HTTP-reachable, so copy it to /tmp/fetch instead.
    if (url.startsWith('/') && (await this.exists(url))) {
      const localPath = `/tmp/fetch/${url.split('/').pop() ?? 'download'}`;
      await this.copy(url, localPath);

      return localPath;
    }

    try {
      const response = await window.fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Download as bytes (binary-safe; `.text()` corrupts fonts/woff2) and store
      // at a path, matching the Node adapter contract where fetch() returns the
      // PATH to the downloaded file (callers then move() it to a final location).
      const data = new Uint8Array(await response.arrayBuffer());
      const name = url.split('/').pop()?.split('?')[0] ?? 'download';
      const downloadPath = `/tmp/fetch/${name}`;
      await this.writeFile(downloadPath, data);

      return downloadPath;
    } catch (error) {
      throw new Error(`Failed to fetch ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async append(targetPath: string, content: string): Promise<void> {
    try {
      if (!(await this.exists(targetPath))) {
        throw new Error(`${targetPath} doesn't exist`);
      }

      const existingData = await this.readFile(targetPath);
      const contentData = new TextEncoder().encode(content);
      const combinedData = new Uint8Array(existingData.length + contentData.length);
      combinedData.set(existingData);
      combinedData.set(contentData, existingData.length);
      await this.writeFile(targetPath, combinedData);
    } catch (error) {
      throw new Error(
        `Failed to append content to ${targetPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async unlink(path: string): Promise<void> {
    await this.remove(path);
  }

  async move(sourcePath: string, targetPath: string): Promise<void> {
    await this.copy(sourcePath, targetPath);
    await this.remove(sourcePath);
  }

  async unzip(_url: string, _targetPath: string): Promise<string[]> {
    throw new Error('ZIP extraction not supported in browser environment. Use a specialized zip library.');
  }

  async fetchAndRead(url: string): Promise<string> {
    const downloadPath = await this.fetch(url);

    return await this.read(downloadPath);
  }

  static isSupported(): boolean {
    return typeof indexedDB !== 'undefined';
  }

  async getStorageUsage(): Promise<{ used: number; available?: number }> {
    return estimateStorageUsage();
  }
}

export default BrowserFilesystemAdapter;
