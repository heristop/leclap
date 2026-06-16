export interface BlobRecord {
  key: string;
  data: Uint8Array;
}

// The slice of persistence the store needs — implemented over IndexedDB in the app
// (projectBlobBackend.ts), faked in tests. Mirrors browserMediaStore's MediaBackend.
export interface BlobBackend {
  put(record: BlobRecord): Promise<void>;
  get(key: string): Promise<BlobRecord | null>;
  delete(key: string): Promise<void>;
}

function defaultMakeKey(): string {
  try {
    return `blob-${globalThis.crypto.randomUUID()}`;
  } catch {
    return `blob-${Date.now()}`;
  }
}

/**
 * Stores project clip + output bytes in IndexedDB, addressed by a generated key. Each `put` mints a
 * fresh key (callers prune stale keys when a clip changes), keeping it simple and append-only.
 */
export class ProjectBlobStore {
  constructor(
    private readonly backend: BlobBackend,
    private readonly makeKey: () => string = defaultMakeKey
  ) {}

  async put(bytes: Uint8Array): Promise<string> {
    const key = this.makeKey();
    await this.backend.put({ key, data: bytes });

    return key;
  }

  async get(key: string): Promise<Uint8Array | null> {
    const record = await this.backend.get(key);

    return record ? record.data : null;
  }

  async has(key: string): Promise<boolean> {
    return (await this.backend.get(key)) !== null;
  }

  async delete(key: string): Promise<void> {
    await this.backend.delete(key);
  }
}
