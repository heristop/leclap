export type MediaKind = 'music' | 'picture'

export interface MediaRecord {
  key: string
  kind: MediaKind
  ext: string
  name: string
  data: Uint8Array
}

export interface MediaMeta {
  kind: MediaKind
  ext: string
  name: string
}

// The slice of persistence the store needs — implemented over IndexedDB in the
// app, faked in tests (mirrors how UserTemplateService injects Storage).
export interface MediaBackend {
  put(record: MediaRecord): Promise<void>
  get(key: string): Promise<MediaRecord | null>
  delete(key: string): Promise<void>
}

function extOf(name: string): string {
  const dot = name.lastIndexOf('.')

  if (dot < 0 || dot === name.length - 1) {
    return 'bin'
  }

  return name.slice(dot + 1).toLowerCase()
}

function defaultMakeKey(): string {
  try {
    return `media-${globalThis.crypto.randomUUID()}`
  } catch {
    return `media-${Date.now()}`
  }
}

/**
 * Persists uploaded media (music / background images) in its own IndexedDB so it
 * survives the engine store's compile-time clear(). Templates reference records
 * by `media://<key>`; compilation materializes the bytes into the engine FS.
 */
export class BrowserMediaStore {
  constructor(
    private readonly backend: MediaBackend,
    private readonly makeKey: () => string = defaultMakeKey
  ) {}

  async save(file: File, kind: MediaKind): Promise<{ key: string; ext: string }> {
    const key = this.makeKey()
    const ext = extOf(file.name)
    const data = new Uint8Array(await file.arrayBuffer())
    await this.backend.put({ key, kind, ext, name: file.name, data })

    return { key, ext }
  }

  async getBytes(key: string): Promise<Uint8Array | null> {
    const record = await this.backend.get(key)

    return record ? record.data : null
  }

  async getMeta(key: string): Promise<MediaMeta | null> {
    const record = await this.backend.get(key)

    if (!record) {
      return null
    }

    return { kind: record.kind, ext: record.ext, name: record.name }
  }

  async previewUrl(key: string): Promise<string | null> {
    const record = await this.backend.get(key)

    if (!record) {
      return null
    }

    return URL.createObjectURL(new Blob([new Uint8Array(record.data)]))
  }

  async remove(key: string): Promise<void> {
    await this.backend.delete(key)
  }
}
