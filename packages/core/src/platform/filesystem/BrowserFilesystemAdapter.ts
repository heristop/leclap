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

@injectable()
class BrowserFilesystemAdapter extends AbstractFilesystem {
  private dbName = 'ffmpeg-video-composer-fs';
  private dbVersion = 1;
  private storeName = 'files';
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

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

        // Create object store for files
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'name' });
          store.createIndex('type', 'metadata.type', { unique: false });
          store.createIndex('lastModified', 'metadata.lastModified', { unique: false });
        }
      };
    });
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }
  }

  async read(path: string): Promise<string> {
    const data = await this.readFile(path);
    return new TextDecoder().decode(data);
  }

  async write(targetPath: string, content?: string): Promise<void> {
    if (content !== undefined) {
      // Write string content to file
      const data = new TextEncoder().encode(content);
      await this.writeFile(targetPath, data);
    } else {
      // This method seems to be used for writing content to target path
      // For browser implementation, we'll create an empty file if it doesn't exist
      if (!(await this.exists(targetPath))) {
        await this.writeFile(targetPath, new Uint8Array(0));
      }
    }
  }

  async readFile(path: string): Promise<Uint8Array> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(path);

      request.onsuccess = () => {
        const result = request.result as FileData | undefined;
        if (result) {
          resolve(result.data);
        } else {
          reject(new Error(`File not found: ${path}`));
        }
      };

      request.onerror = () => {
        reject(new Error(`Failed to read file ${path}: ${request.error?.message}`));
      };
    });
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    await this.ensureInitialized();

    const fileData: FileData = {
      name: path,
      data,
      metadata: {
        size: data.length,
        type: this.getFileType(path),
        lastModified: Date.now(),
      },
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(fileData);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to write file ${path}: ${request.error?.message}`));
      };
    });
  }

  async exists(path: string): Promise<boolean> {
    await this.ensureInitialized();

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.count(path);

      request.onsuccess = () => {
        resolve(request.result > 0);
      };

      request.onerror = () => {
        resolve(false);
      };
    });
  }

  async ensureDir(path: string): Promise<void> {
    // In browser environment, directories are virtual - no need to create them
    // Just ensure the base structure is ready
    console.log(`[BrowserFilesystemAdapter] Virtual directory ensured: ${path}`);
  }

  async copy(src: string, dest: string): Promise<void> {
    const data = await this.readFile(src);
    await this.writeFile(dest, data);
  }

  async remove(path: string): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(path);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to remove file ${path}: ${request.error?.message}`));
      };
    });
  }

  // Browser-specific methods for handling File objects
  async storeFile(file: File, path: string): Promise<void> {
    const data = new Uint8Array(await file.arrayBuffer());
    await this.ensureInitialized();

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

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(fileData);

      request.onsuccess = () => {
        console.log(`[BrowserFilesystemAdapter] Stored file: ${file.name} at ${path}`);
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to store file ${path}: ${request.error?.message}`));
      };
    });
  }

  async getFileMetadata(path: string): Promise<FileData['metadata'] | null> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(path);

      request.onsuccess = () => {
        const result = request.result as FileData | undefined;
        resolve(result ? result.metadata : null);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get metadata for ${path}: ${request.error?.message}`));
      };
    });
  }

  async listFiles(): Promise<string[]> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAllKeys();

      request.onsuccess = () => {
        resolve(request.result as string[]);
      };

      request.onerror = () => {
        reject(new Error(`Failed to list files: ${request.error?.message}`));
      };
    });
  }

  async clear(): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('[BrowserFilesystemAdapter] All files cleared');
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to clear files: ${request.error?.message}`));
      };
    });
  }

  // Abstract method implementations
  async getAssetsPath(dir: string): Promise<string> {
    return `/assets/${dir}`;
  }

  async getBuildPath(buildDir: string): Promise<string> {
    // Don't overwrite the main build directory, just return the requested path
    // The main build directory should be set during initialization
    return this.buildDir ? `${this.buildDir}/${buildDir}` : `/tmp/build/${buildDir}`;
  }

  getSource(segmentName?: string): string {
    if (segmentName) {
      return `/tmp/${segmentName}`;
    }
    return this.segmentName ? `/tmp/${this.segmentName}` : '/tmp/default';
  }

  getDestination(): string {
    // For browser/WASM, use simple filenames to avoid MEMFS directory issues
    // IndexedDB can store these with any key we want later
    return this.segmentName ? `${this.segmentName}_output.mp4` : 'output.mp4';
  }

  async stat(filePath: string): Promise<boolean> {
    return await this.exists(filePath);
  }

  async fetch(url: string): Promise<string> {
    try {
      const response = await window.fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.text();
    } catch (error) {
      throw new Error(`Failed to fetch ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async append(targetPath: string, content: string): Promise<void> {
    try {
      // Check if target file exists (similar to Node.js implementation)
      if (!(await this.exists(targetPath))) {
        throw new Error(`${targetPath} doesn't exist`);
      }

      // Read existing content if file exists
      let existingData = new Uint8Array(0);
      existingData = await this.readFile(targetPath);

      // Convert content string to Uint8Array
      const encoder = new TextEncoder();
      const contentData = encoder.encode(content);

      // Concatenate the data
      const combinedData = new Uint8Array(existingData.length + contentData.length);
      combinedData.set(existingData);
      combinedData.set(contentData, existingData.length);

      // Write combined data
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async unzip(_url: string, _targetPath: string): Promise<string[]> {
    // For browser implementation, we'll throw an error as unzip requires special handling
    // This would typically require a browser-compatible zip library
    throw new Error('ZIP extraction not supported in browser environment. Use a specialized zip library.');
  }

  async fetchAndRead(url: string): Promise<string> {
    return await this.fetch(url);
  }

  private getFileType(path: string): string {
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

  // Static method to check IndexedDB support
  static isSupported(): boolean {
    return typeof indexedDB !== 'undefined';
  }

  // Get storage usage information
  async getStorageUsage(): Promise<{ used: number; available?: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        return {
          used: estimate.usage || 0,
          available: estimate.quota ? estimate.quota - (estimate.usage || 0) : undefined,
        };
      } catch (error) {
        console.warn('Failed to get storage estimate:', error);
      }
    }

    return { used: 0 };
  }
}

export default BrowserFilesystemAdapter;
