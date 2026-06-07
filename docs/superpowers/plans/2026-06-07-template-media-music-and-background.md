# Template Media (music + background image) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Repo owner rule:** never run `git commit`/`git push` without explicit consent. Treat every "Commit" step as a checkpoint to request approval, or batch commits at the end with one approval.

**Goal:** In the web template editor, let authors attach background music and a background image — each by uploading a file or picking from a curated, credited list — and have the in-browser FFmpeg engine play them, with music looping to the full video length.

**Architecture:** Curated picks are self-hosted under `public/` and referenced by URL (portable). Uploads persist in a separate IndexedDB (`leclap-media`) referenced by a `media://<key>` sentinel; at compile time they are materialized into the engine filesystem. Music maps to `global.music`; background maps to a new `image_background` section. Two small core changes: `BrowserFilesystemAdapter.fetch()` resolves local IndexedDB paths, and `MusicWasmAdapter` implements looping.

**Tech Stack:** React 19 + Vite + Tailwind v4 + shadcn-style UI, React Compiler (no manual memo), vitest (`environment: node`, no globals — import from `vitest`), tsyringe DI in `packages/core`, ffmpeg.wasm.

**Spec:** `docs/superpowers/specs/2026-06-07-template-media-music-and-background-design.md`

**Lint rules to honor in every file:** no `else`/`else if` (early returns), `eqeqeq` (`===`), no `useMemo`/`useCallback`/`React.memo`, `useId()` for generated ids, blank line before control-flow statements (`padding-line-before-statements`), `curly` for multi-line, no `// TODO/FIXME`, `max-lines-per-function: 100`, `max-statements: 20`. Test files relax most of these.

**Verification gates (run after each task):** `pnpm test` (vitest), `pnpm lint` (`vp lint`, target 0/0), `pnpm --filter le-clap build`.

---

### Task 1: Core — `BrowserFilesystemAdapter.fetch()` resolves local IndexedDB paths

Uploaded background images are materialized to `/assets/pictures/<key>.<ext>` in the engine's IndexedDB. The engine's `AssetManager` resolves them through `fetch()`, which currently always calls `window.fetch` and so cannot read a virtual path. Make `fetch()` short-circuit when the path already exists in the store.

**Files:**
- Modify: `packages/core/src/platform/filesystem/BrowserFilesystemAdapter.ts` (the `fetch` method, ~line 301)
- Test: `packages/core/tests/browser-filesystem-adapter.test.ts` (create)
- Modify: `packages/core/package.json` (add `fake-indexeddb` devDependency)

- [ ] **Step 1: Add the `fake-indexeddb` dev dependency**

Run: `pnpm --filter @ffmpeg-video-composer/core add -D fake-indexeddb`
Expected: `package.json` gains `fake-indexeddb` under devDependencies; lockfile updates.

- [ ] **Step 2: Write the failing test**

Create `packages/core/tests/browser-filesystem-adapter.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import BrowserFilesystemAdapter from '../src/platform/filesystem/BrowserFilesystemAdapter';

describe('BrowserFilesystemAdapter.fetch', () => {
  beforeEach(() => {
    // The adapter calls window.fetch for remote URLs; stub a window in the node env.
    vi.stubGlobal('window', { fetch: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves a local path that already exists without hitting the network', async () => {
    const fs = new BrowserFilesystemAdapter();
    const bytes = new Uint8Array([1, 2, 3, 4]);
    await fs.writeFile('/assets/pictures/bg.png', bytes);

    const path = await fs.fetch('/assets/pictures/bg.png');

    expect(path).toBe('/tmp/fetch/bg.png');
    expect(await fs.readFile(path)).toEqual(bytes);
    expect((window.fetch as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('falls through to window.fetch for a local path that does not exist', async () => {
    const fs = new BrowserFilesystemAdapter();
    (window.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([9]).buffer,
    });

    await fs.fetch('/not/in/store.png');

    expect(window.fetch).toHaveBeenCalledWith('/not/in/store.png');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @ffmpeg-video-composer/core exec vitest run tests/browser-filesystem-adapter.test.ts`
Expected: FAIL — first test gets `/tmp/fetch/bg.png` only if the new branch exists; currently `fetch` calls `window.fetch('/assets/pictures/bg.png')` (the stub returns undefined → throws), so the test fails.

- [ ] **Step 4: Implement the local-path short-circuit**

In `BrowserFilesystemAdapter.ts`, change the start of `fetch`:

```ts
  async fetch(url: string): Promise<string> {
    // A local virtual path that is already in the store (e.g. an uploaded asset
    // materialized into the engine FS) is not reachable over HTTP. Copy it to the
    // standard /tmp/fetch download location so callers can move() it as usual.
    if (url.startsWith('/') && (await this.exists(url))) {
      const localName = url.split('/').pop() ?? 'download';
      const localPath = `/tmp/fetch/${localName}`;
      await this.copy(url, localPath);

      return localPath;
    }

    try {
      const response = await window.fetch(url);
```

(Leave the rest of the method unchanged.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @ffmpeg-video-composer/core exec vitest run tests/browser-filesystem-adapter.test.ts`
Expected: PASS (both tests).

- [ ] **Step 6: Commit** (request consent first)

```bash
git add packages/core/src/platform/filesystem/BrowserFilesystemAdapter.ts packages/core/tests/browser-filesystem-adapter.test.ts packages/core/package.json pnpm-lock.yaml
git commit -m "feat(core): resolve local IndexedDB paths in BrowserFilesystemAdapter.fetch"
```

---

### Task 2: Core — implement WASM music looping in `MusicWasmAdapter`

`MusicWasmAdapter.process()` is a no-op. Mirror `MusicNodeAdapter`: probe duration via the DI-resolved WASM FFmpeg adapter, and if the track is shorter than the video, loop it with `-stream_loop` and write it back over `musicPath`.

**Files:**
- Modify: `packages/core/src/platform/ffmpeg/MusicWasmAdapter.ts` (full rewrite of `process`)
- Test: `packages/core/tests/music-wasm-adapter.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/core/tests/music-wasm-adapter.test.ts`:

```ts
import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { container } from 'tsyringe';
import MusicWasmAdapter from '../src/platform/ffmpeg/MusicWasmAdapter';

function makeLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeFilesystem() {
  return {
    getBuildDir: vi.fn(() => '/tmp/build'),
    move: vi.fn(async () => undefined),
  };
}

function registerFfmpeg(getInfos: unknown, execute: unknown) {
  container.registerInstance('ffmpegAdapter', { getInfos, execute } as never);
}

describe('MusicWasmAdapter.process', () => {
  beforeEach(() => {
    container.clearInstances();
  });

  it('loops the track when it is shorter than the video', async () => {
    const execute = vi.fn(async () => ({ rc: 0 }));
    registerFfmpeg(vi.fn(async () => ({ duration: 10, videoCodec: null, audioCodec: 'mp3', sampleRate: null })), execute);
    const fs = makeFilesystem();
    const logger = makeLogger();

    const result = await new MusicWasmAdapter().process(logger as never, fs as never, 30, '/assets/musics/song.mp3');

    expect(result.rc).toBe(0);
    expect(execute).toHaveBeenCalledTimes(1);
    const command = (execute.mock.calls[0] as string[])[0];
    expect(command).toContain('-stream_loop -1');
    expect(command).toContain('-i /assets/musics/song.mp3');
    expect(command).toContain('-t 30');
    expect(fs.move).toHaveBeenCalledWith('/tmp/build/loop_music.mp3', '/assets/musics/song.mp3');
  });

  it('does nothing when the track already covers the video', async () => {
    const execute = vi.fn(async () => ({ rc: 0 }));
    registerFfmpeg(vi.fn(async () => ({ duration: 60, videoCodec: null, audioCodec: 'mp3', sampleRate: null })), execute);
    const fs = makeFilesystem();

    const result = await new MusicWasmAdapter().process(makeLogger() as never, fs as never, 30, '/m.mp3');

    expect(result.rc).toBe(0);
    expect(execute).not.toHaveBeenCalled();
    expect(fs.move).not.toHaveBeenCalled();
  });

  it('throws when the loop command fails', async () => {
    registerFfmpeg(vi.fn(async () => ({ duration: 5, videoCodec: null, audioCodec: 'mp3', sampleRate: null })), vi.fn(async () => ({ rc: 1 })));

    await expect(new MusicWasmAdapter().process(makeLogger() as never, makeFilesystem() as never, 30, '/m.mp3')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ffmpeg-video-composer/core exec vitest run tests/music-wasm-adapter.test.ts`
Expected: FAIL — the current `process` never calls execute or move.

- [ ] **Step 3: Implement looping**

Replace the body of `packages/core/src/platform/ffmpeg/MusicWasmAdapter.ts`:

```ts
import { container, injectable } from 'tsyringe';
import type AbstractLogger from '../../platform/logging/AbstractLogger';
import type AbstractFilesystem from '../../platform/filesystem/AbstractFilesystem';
import type AbstractFFmpeg from './AbstractFFmpeg';
import type AbstractMusic from './AbstractMusic';

interface ProcessResult {
  rc: number;
}

@injectable()
class MusicWasmAdapter implements AbstractMusic {
  /**
   * Loop the background track to cover the full video length, in the browser.
   * Probes duration via the WASM FFmpeg adapter, then `-stream_loop`s the input
   * and trims to `totalLength`, writing the result back over `musicPath`.
   */
  process = async (
    logger: AbstractLogger,
    filesystemAdapter: AbstractFilesystem,
    totalLength: number,
    musicPath: string
  ): Promise<ProcessResult> => {
    try {
      const ffmpeg = container.resolve<AbstractFFmpeg>('ffmpegAdapter');
      const infos = await ffmpeg.getInfos(musicPath);
      const musicLength = infos.duration ?? 0;
      logger.info(`[MusicWasmAdapter] Duration: ${musicLength} / ${totalLength}`);

      if (musicLength <= 0 || musicLength >= totalLength) {
        return { rc: 0 };
      }

      const buildDir = filesystemAdapter.getBuildDir() ?? '/tmp/build';
      const loop = `${buildDir}/loop_music.mp3`;
      const command = ` -y -stream_loop -1 -i ${musicPath} -t ${totalLength} -c copy ${loop} `;
      logger.debug(`[MusicWasmAdapter][Command] ffmpeg ${command}`);

      const result = await ffmpeg.execute(command);

      if (result.rc !== 0) {
        throw new Error('Failed to loop music in browser');
      }

      await filesystemAdapter.move(loop, musicPath);
      logger.info('[MusicWasmAdapter][Loop] ffmpeg process completed');

      return { rc: 0 };
    } catch (error: unknown) {
      if (!(error instanceof Error)) {
        logger.error('[MusicWasmAdapter] Unknown error occurred');

        throw error;
      }

      logger.error(`[MusicWasmAdapter] Error: ${error.message}`);

      throw error;
    }
  };
}

export default MusicWasmAdapter;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @ffmpeg-video-composer/core exec vitest run tests/music-wasm-adapter.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit** (request consent first)

```bash
git add packages/core/src/platform/ffmpeg/MusicWasmAdapter.ts packages/core/tests/music-wasm-adapter.test.ts
git commit -m "feat(core): implement in-browser music looping in MusicWasmAdapter"
```

---

### Task 3: Web — curated media catalogs + self-hosted assets

Define typed catalogs of credited tracks and images, served from `public/`. Seed music with the track already bundled in the repo, then source additional CC0 tracks and Unsplash images. An integrity test enforces that every entry points to a file that exists and has complete credit fields.

**Files:**
- Create: `apps/le-clap-web/src/data/mediaCatalog.ts`
- Create: `apps/le-clap-web/public/musics/` and `apps/le-clap-web/public/backgrounds/` (asset files)
- Test: `apps/le-clap-web/src/data/mediaCatalog.test.ts`

- [ ] **Step 1: Seed the first music asset from the repo**

Run: `mkdir -p apps/le-clap-web/public/musics apps/le-clap-web/public/backgrounds && cp "packages/core/src/shared/assets/musics/point_being_-_go_by_ocean___ryan_mccaffrey.mp3" apps/le-clap-web/public/musics/go-by-ocean.mp3`
Expected: `apps/le-clap-web/public/musics/go-by-ocean.mp3` exists.

- [ ] **Step 2: Source the rest of the curated assets**

Using `WebSearch`/`WebFetch`, download about 4 more royalty-free tracks (CC0 / Pixabay Music) into `public/musics/*.mp3` and about 6 Unsplash photos into `public/backgrounds/*.jpg`. For each asset record: a human title, the author/photographer name, the license label, and the source page URL. Keep files reasonably small (tracks ideally 30–90s; images ≤ ~500 KB, resized to ~1600px wide). Acceptance: each downloaded file plays/renders and you have its credit metadata. (If sourcing is blocked, ship with the single seed track and zero curated backgrounds — the upload path still works — and note the gap.)

- [ ] **Step 3: Write the catalog module**

Create `apps/le-clap-web/src/data/mediaCatalog.ts` (fill `MUSIC_LIBRARY` / `BACKGROUND_LIBRARY` with the real assets from Steps 1–2; the `go-by-ocean` seed entry is shown):

```ts
// Curated, credited media served from /public. Picks are referenced by URL in
// the template descriptor, so they stay portable across devices.
export interface MediaCredit {
  id: string
  title: string
  author: string
  license: string
  sourceUrl: string
  url: string // same-origin path under /public
}

export const MUSIC_LIBRARY: MediaCredit[] = [
  {
    id: 'go-by-ocean',
    title: 'Go by Ocean',
    author: 'Ryan McCaffrey',
    license: 'Bundled sample',
    sourceUrl: 'https://github.com/heristop/ffmpeg-video-composer',
    url: '/musics/go-by-ocean.mp3',
  },
  // ...additional CC0 / Pixabay tracks from Step 2
]

export const BACKGROUND_LIBRARY: MediaCredit[] = [
  // ...Unsplash photos from Step 2, e.g.
  // { id: 'sunset-dunes', title: 'Sunset Dunes', author: 'Jane Doe',
  //   license: 'Unsplash License', sourceUrl: 'https://unsplash.com/photos/xxxx',
  //   url: '/backgrounds/sunset-dunes.jpg' },
]

export const findMusic = (id: string): MediaCredit | undefined => MUSIC_LIBRARY.find((m) => m.id === id)
export const findBackground = (id: string): MediaCredit | undefined => BACKGROUND_LIBRARY.find((m) => m.id === id)
export const findMusicByUrl = (url: string): MediaCredit | undefined => MUSIC_LIBRARY.find((m) => m.url === url)
export const findBackgroundByUrl = (url: string): MediaCredit | undefined => BACKGROUND_LIBRARY.find((m) => m.url === url)
```

- [ ] **Step 4: Write the integrity test**

Create `apps/le-clap-web/src/data/mediaCatalog.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { MUSIC_LIBRARY, BACKGROUND_LIBRARY, type MediaCredit } from './mediaCatalog'

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../public')

function checkCatalog(name: string, entries: MediaCredit[]) {
  describe(name, () => {
    it('has unique ids', () => {
      const ids = entries.map((e) => e.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it.each(entries)('$id has complete credit fields and an existing file', (entry) => {
      expect(entry.title.length).toBeGreaterThan(0)
      expect(entry.author.length).toBeGreaterThan(0)
      expect(entry.license.length).toBeGreaterThan(0)
      expect(entry.sourceUrl.length).toBeGreaterThan(0)
      expect(entry.url.startsWith('/')).toBe(true)
      const filePath = resolve(publicDir, `.${entry.url}`)
      expect(existsSync(filePath), `missing file: ${filePath}`).toBe(true)
      expect(readFileSync(filePath).length).toBeGreaterThan(0)
    })
  })
}

checkCatalog('MUSIC_LIBRARY', MUSIC_LIBRARY)
checkCatalog('BACKGROUND_LIBRARY', BACKGROUND_LIBRARY)
```

- [ ] **Step 5: Run the test**

Run: `pnpm --filter le-clap exec vitest run src/data/mediaCatalog.test.ts`
Expected: PASS — every catalog entry resolves to a real file in `public/`.

- [ ] **Step 6: Commit** (request consent first)

```bash
git add apps/le-clap-web/src/data/mediaCatalog.ts apps/le-clap-web/src/data/mediaCatalog.test.ts apps/le-clap-web/public/musics apps/le-clap-web/public/backgrounds
git commit -m "feat(web): add curated music and background media catalogs"
```

---

### Task 4: Web — `BrowserMediaStore` for persistent uploads

A pure store over an injected backend persists uploaded files in their own IndexedDB so they survive the compile-time `clear()` of the engine store. Keys are generated; previews use object URLs.

**Files:**
- Create: `apps/le-clap-web/src/stores/browserMediaStore.ts`
- Create: `apps/le-clap-web/src/services/browserMediaService.ts` (real IndexedDB backend wiring)
- Test: `apps/le-clap-web/src/stores/browserMediaStore.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/le-clap-web/src/stores/browserMediaStore.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { BrowserMediaStore, type MediaBackend, type MediaRecord } from './browserMediaStore'

function fakeBackend(): MediaBackend {
  const map = new Map<string, MediaRecord>()

  return {
    put: async (rec) => { map.set(rec.key, rec) },
    get: async (key) => map.get(key) ?? null,
    delete: async (key) => { map.delete(key) },
  }
}

function fakeFile(name: string, bytes = [1, 2, 3]): File {
  return new File([new Uint8Array(bytes)], name, { type: 'audio/mpeg' })
}

describe('BrowserMediaStore', () => {
  it('saves a file under a generated key with its kind, ext and name', async () => {
    let n = 0
    const store = new BrowserMediaStore(fakeBackend(), () => `key-${++n}`)

    const saved = await store.save(fakeFile('My Track.mp3'), 'music')

    expect(saved.key).toBe('key-1')
    expect(saved.ext).toBe('mp3')
    const meta = await store.getMeta('key-1')
    expect(meta).toEqual({ kind: 'music', ext: 'mp3', name: 'My Track.mp3' })
  })

  it('returns the raw bytes for materialization', async () => {
    const store = new BrowserMediaStore(fakeBackend(), () => 'k')
    await store.save(fakeFile('a.mp3', [9, 8, 7]), 'music')

    expect(await store.getBytes('k')).toEqual(new Uint8Array([9, 8, 7]))
    expect(await store.getBytes('missing')).toBeNull()
  })

  it('removes a record', async () => {
    const store = new BrowserMediaStore(fakeBackend(), () => 'k')
    await store.save(fakeFile('a.mp3'), 'music')
    await store.remove('k')

    expect(await store.getBytes('k')).toBeNull()
  })

  it('derives ext from the file name, defaulting to bin', async () => {
    const store = new BrowserMediaStore(fakeBackend(), () => 'k')
    const saved = await store.save(new File([new Uint8Array([1])], 'noext'), 'picture')

    expect(saved.ext).toBe('bin')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter le-clap exec vitest run src/stores/browserMediaStore.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the store**

Create `apps/le-clap-web/src/stores/browserMediaStore.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter le-clap exec vitest run src/stores/browserMediaStore.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire the real IndexedDB backend**

Create `apps/le-clap-web/src/services/browserMediaService.ts`:

```ts
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
```

- [ ] **Step 6: Verify lint/build**

Run: `pnpm lint` and `pnpm --filter le-clap build`
Expected: 0/0 lint; build succeeds.

- [ ] **Step 7: Commit** (request consent first)

```bash
git add apps/le-clap-web/src/stores/browserMediaStore.ts apps/le-clap-web/src/stores/browserMediaStore.test.ts apps/le-clap-web/src/services/browserMediaService.ts
git commit -m "feat(web): add BrowserMediaStore for persistent uploaded media"
```

---

### Task 5: Web — extend the editor model with music + image-background

Add an `image` section kind and a `music` selection to `EditorState`, and compile both to/from the descriptor. This is pure logic and the most heavily tested part.

**Files:**
- Modify: `apps/le-clap-web/src/presentation/components/admin/templateEditorModel.ts`
- Test: `apps/le-clap-web/src/presentation/components/admin/templateEditorModel.test.ts` (create)

- [ ] **Step 1: Write the failing round-trip test**

Create `apps/le-clap-web/src/presentation/components/admin/templateEditorModel.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildDescriptor, toEditorState, newSection, type EditorState } from './templateEditorModel'
import { MUSIC_LIBRARY, BACKGROUND_LIBRARY } from '@/data/mediaCatalog'
import type { Template } from '@/services/templateService'

function baseState(over: Partial<EditorState> = {}): EditorState {
  return {
    id: 'user-1', name: 'T', description: '', orientation: 'landscape',
    musicEnabled: false, music: null, sections: [newSection('video')], ...over,
  }
}

function asTemplate(state: EditorState): Template {
  return {
    id: state.id, name: state.name, description: state.description, orientation: state.orientation,
    hasForm: false, complexity: 'simple', source: 'user', descriptor: buildDescriptor(state),
  }
}

describe('templateEditorModel media', () => {
  it('builds global.music for a library pick when music is enabled', () => {
    const lib = MUSIC_LIBRARY[0]
    const d = buildDescriptor(baseState({ musicEnabled: true, music: { source: 'library', id: lib.id } }))

    expect(d.global?.musicEnabled).toBe(true)
    expect(d.global?.music).toEqual({ name: lib.id, url: lib.url })
  })

  it('builds a media:// sentinel for an uploaded track', () => {
    const d = buildDescriptor(baseState({ musicEnabled: true, music: { source: 'upload', key: 'k1', label: 'a.mp3' } }))

    expect(d.global?.music).toEqual({ name: 'k1', url: 'media://k1' })
  })

  it('omits global.music when music is disabled', () => {
    const d = buildDescriptor(baseState({ musicEnabled: false, music: { source: 'upload', key: 'k1', label: 'a.mp3' } }))

    expect(d.global?.music).toBeUndefined()
  })

  it('builds an image_background section for a library background', () => {
    const bg = BACKGROUND_LIBRARY[0] ?? { id: 'x', url: '/backgrounds/x.jpg' }
    const d = buildDescriptor(baseState({
      sections: [{ kind: 'image', duration: 4, background: { source: 'library', id: bg.id } }],
    }))

    expect(d.sections?.[0]).toMatchObject({
      name: 'image_1', type: 'image_background', options: { duration: 4, pictureUrl: bg.url ?? '' },
    })
  })

  it('round-trips an uploaded image and a library track through a stored template', () => {
    const lib = MUSIC_LIBRARY[0]
    const start = baseState({
      musicEnabled: true,
      music: { source: 'library', id: lib.id },
      sections: [{ kind: 'image', duration: 6, background: { source: 'upload', key: 'imgK', label: 'p.png' } }],
    })

    const back = toEditorState(asTemplate(start))

    expect(back.musicEnabled).toBe(true)
    expect(back.music).toEqual({ source: 'library', id: lib.id })
    expect(back.sections[0]).toMatchObject({ kind: 'image', duration: 6 })
    expect(back.sections[0]).toMatchObject({ background: { source: 'upload', key: 'imgK' } })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter le-clap exec vitest run src/presentation/components/admin/templateEditorModel.test.ts`
Expected: FAIL — `music`/`image` not in the model yet.

- [ ] **Step 3: Add the media types and section kind**

In `templateEditorModel.ts`, add imports and types near the top (after the existing imports):

```ts
import { findMusic, findBackground, findMusicByUrl, findBackgroundByUrl } from '@/data/mediaCatalog'

export type MediaChoice =
  | { source: 'library'; id: string }
  | { source: 'upload'; key: string; label: string }
```

Extend the `EditorSection` union with an image variant:

```ts
export type EditorSection =
  | { kind: 'form'; fields: FormField[] }
  | { kind: 'video'; duration: number; mute: boolean; text: string; fontsize: number; fontcolor: string }
  | { kind: 'color'; duration: number; color: string }
  | { kind: 'image'; duration: number; background: MediaChoice | null }
```

Add `music` to `EditorState`:

```ts
export interface EditorState {
  id: string
  name: string
  description: string
  orientation: 'landscape' | 'portrait'
  musicEnabled: boolean
  music: MediaChoice | null
  sections: EditorSection[]
}
```

Add the label and `newSection` case:

```ts
export const SECTION_LABELS: Record<EditorSection['kind'], string> = {
  form: 'Form fields',
  video: 'Your video',
  color: 'Color background',
  image: 'Background image',
}
```

In `newSection`, add before the final `return` (the video default):

```ts
  if (kind === 'image') return { kind: 'image', duration: 4, background: null }
```

- [ ] **Step 4: Resolve choices to descriptor values**

Add these pure helpers in `templateEditorModel.ts`:

```ts
function musicConfigFrom(choice: MediaChoice): { name: string; url?: string } {
  if (choice.source === 'upload') {
    return { name: choice.key, url: `media://${choice.key}` }
  }

  return { name: choice.id, url: findMusic(choice.id)?.url }
}

function pictureUrlFrom(choice: MediaChoice | null): string {
  if (!choice) {
    return ''
  }

  if (choice.source === 'upload') {
    return `media://${choice.key}`
  }

  return findBackground(choice.id)?.url ?? ''
}

function choiceFromUrl(rawUrl: string | undefined, kind: 'music' | 'background'): MediaChoice | null {
  const url = rawUrl ?? ''

  if (url === '') {
    return null
  }

  if (url.startsWith('media://')) {
    return { source: 'upload', key: url.slice('media://'.length), label: 'Uploaded file' }
  }

  const match = kind === 'music' ? findMusicByUrl(url) : findBackgroundByUrl(url)

  return match ? { source: 'library', id: match.id } : null
}
```

- [ ] **Step 5: Emit music + image in `buildDescriptor`**

Add an image counter alongside `videoIndex` at the top of `buildDescriptor`:

```ts
  let videoIndex = 0
  let imageIndex = 0
```

In the `state.sections.map(...)` callback, add an image branch before the video fallback:

```ts
    if (section.kind === 'image') {
      imageIndex += 1

      return {
        name: `image_${imageIndex}`,
        type: 'image_background',
        options: { duration: section.duration, pictureUrl: pictureUrlFrom(section.background) },
      }
    }
```

Replace the final `return` of `buildDescriptor` with a version that conditionally attaches music:

```ts
  const global: NonNullable<TemplateDescriptor['global']> = {
    orientation: state.orientation,
    musicEnabled: state.musicEnabled,
    transitionDuration: 0.5,
  }

  if (state.musicEnabled && state.music) {
    global.music = musicConfigFrom(state.music)
  }

  return { global, sections }
```

- [ ] **Step 6: Rehydrate music + image in `toEditorState`**

Add an image rehydrator and wire it into `storedSectionToEditor`:

```ts
function imageSectionFrom(s: StoredSection): EditorSection {
  return {
    kind: 'image',
    duration: s.options?.duration ?? 4,
    background: choiceFromUrl(s.options?.pictureUrl, 'background'),
  }
}
```

In `storedSectionToEditor`, add before the video fallback:

```ts
  if (s.type === 'image_background') return imageSectionFrom(s)
```

In the empty-template branch of `toEditorState`, add `music: null,`. In the hydrate branch, add:

```ts
    music: choiceFromUrl(template.descriptor.global?.music?.url, 'music'),
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm --filter le-clap exec vitest run src/presentation/components/admin/templateEditorModel.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 8: Commit** (request consent first)

```bash
git add apps/le-clap-web/src/presentation/components/admin/templateEditorModel.ts apps/le-clap-web/src/presentation/components/admin/templateEditorModel.test.ts
git commit -m "feat(web): model music and image-background in the template editor"
```

---

### Task 6: Web — materialize uploaded media at compile time

After the engine store is cleared and before compilation, copy uploaded blobs from `BrowserMediaStore` into the engine filesystem and rewrite `media://` references to real engine paths.

**Files:**
- Create: `apps/le-clap-web/src/application/usecases/materializeTemplateMedia.ts`
- Modify: `apps/le-clap-web/src/application/usecases/coreCompilationService.ts`
- Test: `apps/le-clap-web/src/application/usecases/materializeTemplateMedia.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/le-clap-web/src/application/usecases/materializeTemplateMedia.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { materializeTemplateMedia, type MediaSource, type MediaTarget } from './materializeTemplateMedia'
import type { TemplateDescriptor } from '@ffmpeg-video-composer/core/src/core/types.d.ts'

function sourceWith(records: Record<string, { bytes: Uint8Array; ext: string }>): MediaSource {
  return {
    getBytes: async (k) => records[k]?.bytes ?? null,
    getMeta: async (k) => (records[k] ? { kind: 'picture', ext: records[k].ext, name: 'n' } : null),
  }
}

describe('materializeTemplateMedia', () => {
  it('writes an uploaded track and rewrites global.music to a cache name', async () => {
    const writes: Array<{ path: string; bytes: Uint8Array }> = []
    const target: MediaTarget = { writeFile: async (path, bytes) => { writes.push({ path, bytes }) } }
    const descriptor: TemplateDescriptor = { global: { music: { name: 'k1', url: 'media://k1' } }, sections: [] }

    await materializeTemplateMedia(descriptor, sourceWith({ k1: { bytes: new Uint8Array([1]), ext: 'mp3' } }), target)

    expect(writes[0].path).toBe('/assets/musics/k1.mp3')
    expect(descriptor.global?.music).toEqual({ name: 'k1' })
  })

  it('writes an uploaded image and rewrites pictureUrl to an engine path', async () => {
    const target: MediaTarget = { writeFile: vi.fn(async () => undefined) }
    const descriptor: TemplateDescriptor = {
      global: {},
      sections: [{ name: 'image_1', type: 'image_background', options: { pictureUrl: 'media://imgK' } }],
    }

    await materializeTemplateMedia(descriptor, sourceWith({ imgK: { bytes: new Uint8Array([2]), ext: 'png' } }), target)

    expect(target.writeFile).toHaveBeenCalledWith('/assets/pictures/imgK.png', new Uint8Array([2]))
    expect(descriptor.sections?.[0].options?.pictureUrl).toBe('/assets/pictures/imgK.png')
  })

  it('leaves curated URLs untouched', async () => {
    const target: MediaTarget = { writeFile: vi.fn(async () => undefined) }
    const descriptor: TemplateDescriptor = {
      global: { music: { name: 'go', url: '/musics/go.mp3' } },
      sections: [{ name: 'image_1', type: 'image_background', options: { pictureUrl: '/backgrounds/x.jpg' } }],
    }

    await materializeTemplateMedia(descriptor, sourceWith({}), target)

    expect(target.writeFile).not.toHaveBeenCalled()
    expect(descriptor.global?.music?.url).toBe('/musics/go.mp3')
  })

  it('throws a clear error when an uploaded blob is missing', async () => {
    const target: MediaTarget = { writeFile: vi.fn(async () => undefined) }
    const descriptor: TemplateDescriptor = { global: { music: { name: 'k', url: 'media://k' } }, sections: [] }

    await expect(materializeTemplateMedia(descriptor, sourceWith({}), target)).rejects.toThrow(/no longer available/)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter le-clap exec vitest run src/application/usecases/materializeTemplateMedia.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement materialization**

Create `apps/le-clap-web/src/application/usecases/materializeTemplateMedia.ts`:

```ts
import type { TemplateDescriptor } from '@ffmpeg-video-composer/core/src/core/types.d.ts'

const PREFIX = 'media://'

export interface MediaSource {
  getBytes(key: string): Promise<Uint8Array | null>
  getMeta(key: string): Promise<{ kind: string; ext: string; name: string } | null>
}

export interface MediaTarget {
  writeFile(path: string, data: Uint8Array): Promise<void>
}

async function readOrThrow(source: MediaSource, key: string): Promise<Uint8Array> {
  const bytes = await source.getBytes(key)

  if (!bytes) {
    throw new Error('An uploaded media file is no longer available — re-select it in the template.')
  }

  return bytes
}

/**
 * Copies uploaded blobs (referenced as `media://<key>`) into the engine filesystem
 * and rewrites the descriptor to point at the materialized engine paths. Curated
 * URLs are left untouched. Mutates `descriptor` in place.
 */
export async function materializeTemplateMedia(
  descriptor: TemplateDescriptor,
  source: MediaSource,
  target: MediaTarget
): Promise<void> {
  const musicUrl = descriptor.global?.music?.url

  if (musicUrl?.startsWith(PREFIX) && descriptor.global?.music) {
    const key = musicUrl.slice(PREFIX.length)
    const bytes = await readOrThrow(source, key)
    await target.writeFile(`/assets/musics/${key}.mp3`, bytes)
    descriptor.global.music = { name: key }
  }

  for (const section of descriptor.sections ?? []) {
    const url = section.options?.pictureUrl

    if (section.type !== 'image_background' || !url?.startsWith(PREFIX)) {
      continue
    }

    const key = url.slice(PREFIX.length)
    const meta = await source.getMeta(key)
    const bytes = await readOrThrow(source, key)
    const path = `/assets/pictures/${key}.${meta?.ext ?? 'bin'}`
    await target.writeFile(path, bytes)
    section.options = { ...section.options, pictureUrl: path }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter le-clap exec vitest run src/application/usecases/materializeTemplateMedia.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Call materialize from the compile flow**

In `coreCompilationService.ts`, add imports:

```ts
import { browserMediaService } from '@/services/browserMediaService';
import { materializeTemplateMedia } from '@/application/usecases/materializeTemplateMedia';
```

In `compileVideo`, after `const templateDescriptor = this.prepareTemplateDescriptor(...)` and before `runCompilation`, insert:

```ts
      await materializeTemplateMedia(templateDescriptor, browserMediaService, this.filesystemAdapter);
```

(`this.filesystemAdapter` already exposes `writeFile`, satisfying `MediaTarget`.)

- [ ] **Step 6: Verify lint/build/tests**

Run: `pnpm test`, `pnpm lint`, `pnpm --filter le-clap build`
Expected: tests pass; lint 0/0; build succeeds.

- [ ] **Step 7: Commit** (request consent first)

```bash
git add apps/le-clap-web/src/application/usecases/materializeTemplateMedia.ts apps/le-clap-web/src/application/usecases/materializeTemplateMedia.test.ts apps/le-clap-web/src/application/usecases/coreCompilationService.ts
git commit -m "feat(web): materialize uploaded template media before compilation"
```

---

### Task 7: Web — `MediaPicker` UI (upload or curated list)

A reusable control with an Upload / Library switch. Built with the design-system primitives; split into subcomponents to honor `max-lines-per-function`. After this task, run the `impeccable` audit and `ui-ux-pro-max` skill to polish spacing, states, and a11y.

**Files:**
- Create: `apps/le-clap-web/src/presentation/components/admin/MediaPicker.tsx`

- [ ] **Step 1: Implement the picker**

Create `apps/le-clap-web/src/presentation/components/admin/MediaPicker.tsx`:

```tsx
import { useState, useId, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, Music, Image as ImageIcon, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/presentation/components/ui'
import { browserMediaService } from '@/services/browserMediaService'
import { MUSIC_LIBRARY, BACKGROUND_LIBRARY, findMusic, findBackground, type MediaCredit } from '@/data/mediaCatalog'
import type { MediaChoice } from './templateEditorModel'

type MediaKind = 'music' | 'picture'

interface MediaPickerProps {
  kind: MediaKind
  value: MediaChoice | null
  onChange: (choice: MediaChoice | null) => void
}

const ACCEPT: Record<MediaKind, Record<string, string[]>> = {
  music: { 'audio/*': ['.mp3', '.wav', '.m4a', '.aac', '.ogg'] },
  picture: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
}

function catalogFor(kind: MediaKind): MediaCredit[] {
  return kind === 'music' ? MUSIC_LIBRARY : BACKGROUND_LIBRARY
}

function selectedCredit(kind: MediaKind, value: MediaChoice | null): MediaCredit | undefined {
  if (!value || value.source !== 'library') {
    return undefined
  }

  return kind === 'music' ? findMusic(value.id) : findBackground(value.id)
}

export const MediaPicker = ({ kind, value, onChange }: MediaPickerProps) => {
  const [tab, setTab] = useState<'library' | 'upload'>(value?.source === 'upload' ? 'upload' : 'library')

  return (
    <div className="rounded-xl border border-foreground/10 bg-surface-2/40 p-3">
      <TabSwitch tab={tab} setTab={setTab} />
      {tab === 'library' && <LibraryGrid kind={kind} value={value} onChange={onChange} />}
      {tab === 'upload' && <UploadPane kind={kind} value={value} onChange={onChange} />}
    </div>
  )
}

const TabSwitch = ({ tab, setTab }: { tab: 'library' | 'upload'; setTab: (t: 'library' | 'upload') => void }) => (
  <div role="tablist" aria-label="Media source" className="mb-3 inline-flex rounded-lg bg-foreground/5 p-0.5 text-sm">
    {(['library', 'upload'] as const).map((t) => (
      <button
        key={t}
        role="tab"
        type="button"
        aria-selected={tab === t}
        onClick={() => { setTab(t) }}
        className={cn(
          'rounded-md px-3 py-1.5 font-medium capitalize transition-colors',
          tab === t ? 'bg-surface text-foreground shadow-sm' : 'text-gray-400 hover:text-foreground'
        )}
      >
        {t}
      </button>
    ))}
  </div>
)

const LibraryGrid = ({ kind, value, onChange }: MediaPickerProps) => {
  const items = catalogFor(kind)

  if (items.length === 0) {
    return <p className="px-1 py-3 text-sm text-gray-400">No tracks yet — upload one instead.</p>
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((item) => (
        <LibraryCard
          key={item.id}
          item={item}
          kind={kind}
          selected={value?.source === 'library' && value.id === item.id}
          onPick={() => { onChange({ source: 'library', id: item.id }) }}
        />
      ))}
    </div>
  )
}

const LibraryCard = ({ item, kind, selected, onPick }: { item: MediaCredit; kind: MediaKind; selected: boolean; onPick: () => void }) => (
  <button
    type="button"
    onClick={onPick}
    aria-pressed={selected}
    className={cn(
      'group relative overflow-hidden rounded-lg border p-2 text-left transition-all',
      selected ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-foreground/10 hover:border-brand-500/40'
    )}
  >
    {kind === 'picture' && <img src={item.url} alt="" loading="lazy" className="mb-2 h-16 w-full rounded object-cover" />}
    <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
      {kind === 'music' ? <Music className="h-3.5 w-3.5 shrink-0 text-brand-400" /> : null}
      <span className="truncate">{item.title}</span>
      {selected ? <Check className="ml-auto h-3.5 w-3.5 text-brand-400" /> : null}
    </span>
    <span className="mt-0.5 block truncate text-[0.65rem] text-gray-400">{item.author} · {item.license}</span>
    {kind === 'music' && <audio src={item.url} controls preload="none" aria-label={`Preview ${item.title}`} className="mt-2 h-7 w-full" />}
  </button>
)

const UploadPane = ({ kind, value, onChange }: MediaPickerProps) => {
  const inputId = useId()
  const [label, setLabel] = useState(value?.source === 'upload' ? value.label : '')

  useEffect(() => {
    if (value?.source === 'upload' && value.label !== label) {
      setLabel(value.label)
    }
  }, [value, label])

  const onDrop = (files: File[]) => {
    const file = files[0]

    if (!file) {
      return
    }

    browserMediaService.save(file, kind).then(({ key }) => {
      onChange({ source: 'upload', key, label: file.name })
    }).catch(() => { /* surfaced by the empty selection state */ })
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: ACCEPT[kind], maxFiles: 1, multiple: false })

  if (value?.source === 'upload' && label !== '') {
    return <SelectedUpload kind={kind} label={label} onClear={() => { onChange(null) }} />
  }

  return (
    <div
      {...getRootProps()}
      aria-label={kind === 'music' ? 'Upload a music file' : 'Upload a background image'}
      className={cn(
        'flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors',
        isDragActive ? 'border-brand-500 bg-brand-500/10' : 'border-foreground/15 hover:border-brand-500/50'
      )}
    >
      <input {...getInputProps()} id={inputId} aria-label={kind === 'music' ? 'Upload a music file' : 'Upload a background image'} />
      <Upload className="h-6 w-6 text-gray-400" />
      <span className="text-sm text-gray-300">Drop a {kind === 'music' ? 'track' : 'image'} or click to browse</span>
    </div>
  )
}

const SelectedUpload = ({ kind, label, onClear }: { kind: MediaKind; label: string; onClear: () => void }) => (
  <div className="flex items-center gap-2 rounded-lg border border-brand-500/30 bg-brand-500/10 p-3">
    {kind === 'music' ? <Music className="h-4 w-4 text-brand-400" /> : <ImageIcon className="h-4 w-4 text-brand-400" />}
    <span className="truncate text-sm text-foreground">{label}</span>
    <Button variant="ghost" size="icon" onClick={onClear} aria-label="Remove uploaded file" className="ml-auto text-gray-400">
      <X className="h-4 w-4" />
    </Button>
  </div>
)
```

- [ ] **Step 2: Verify lint/build**

Run: `pnpm lint` and `pnpm --filter le-clap build`
Expected: 0/0 lint (no `else`, blank lines before returns, no manual memo); build succeeds.

- [ ] **Step 3: Polish with the design skills**

Invoke the `impeccable` audit (a11y/theming/responsive) and the `ui-ux-pro-max` skill against `MediaPicker.tsx`; apply fixes (touch targets ≥44px, focus-visible already global, dark-mode tokens, no AI-slop patterns). Re-run lint/build.

- [ ] **Step 4: Commit** (request consent first)

```bash
git add apps/le-clap-web/src/presentation/components/admin/MediaPicker.tsx
git commit -m "feat(web): add MediaPicker (upload or curated list) for template media"
```

---

### Task 8: Web — wire MediaPicker into `TemplateEditor`

Add the music picker under the "Background music" toggle, a "Background image" button to the Add-section row, the image section body, and a save-time guard for required selections.

**Files:**
- Modify: `apps/le-clap-web/src/presentation/components/admin/TemplateEditor.tsx`

- [ ] **Step 1: Import the picker, types, and an icon**

Update imports in `TemplateEditor.tsx`:

```tsx
import { GripVertical, Trash2, Plus, X, Type, Video as VideoIcon, Square, FileText, Save, ArrowDown, Image as ImageIcon } from 'lucide-react'
import { MediaPicker } from './MediaPicker'
import {
  buildDescriptor,
  newSection,
  SECTION_LABELS,
  toEditorState,
  type EditorSection,
  type EditorState,
  type MediaChoice,
} from './templateEditorModel'
```

- [ ] **Step 2: Reveal the music picker under the toggle**

In `MetadataFields`, replace the music `<label>` block with the toggle plus a conditional picker:

```tsx
      <div className="sm:col-span-2">
        <label className="flex w-fit items-center gap-2 text-sm text-gray-200 cursor-pointer select-none">
          <Checkbox checked={state.musicEnabled} onCheckedChange={(c) => { patch({ musicEnabled: c === true }); }} />
          Background music
        </label>
        {state.musicEnabled && (
          <div className="mt-3">
            <MediaPicker kind="music" value={state.music} onChange={(music) => { patch({ music }); }} />
          </div>
        )}
      </div>
```

- [ ] **Step 3: Add the "Background image" section button**

In `AddSectionButtons`, extend the kinds array:

```tsx
    {(['video', 'form', 'color', 'image'] as const).map((kind) => (
```

- [ ] **Step 4: Add the image icon and section body**

In `SectionIcon`, add before the video fallback `return`:

```tsx
  if (kind === 'image') return <ImageIcon className="w-4 h-4 text-brand-700 dark:text-brand-300" />
```

In `SectionFields`, add an image branch before the `// form` fallback:

```tsx
  if (section.kind === 'image') {
    return (
      <div className="grid gap-3 pl-7">
        <NumberField label="Duration (s)" value={section.duration} onChange={(v) => { onChange({ duration: v }); }} inputCls={inputCls} />
        <MediaPicker kind="picture" value={section.background} onChange={(background: MediaChoice | null) => { onChange({ background }); }} />
      </div>
    )
  }
```

- [ ] **Step 5: Guard required selections in `handleSave`**

In `handleSave`, after the `state.sections.length === 0` check, add:

```tsx
    if (state.musicEnabled && !state.music) {
      setError('Pick a music track, or turn off background music.')

      return
    }

    const missingImage = state.sections.some((s) => s.kind === 'image' && !s.background)

    if (missingImage) {
      setError('Choose a background image for each Background image section.')

      return
    }
```

- [ ] **Step 6: Verify lint/build manually**

Run: `pnpm lint` and `pnpm --filter le-clap build`
Expected: 0/0 lint; build succeeds.

- [ ] **Step 7: Manual smoke test**

Run: `pnpm --filter le-clap dev`, open the template editor:
- Enable "Background music" → pick a library track (preview plays) and Save; reopen → the track stays selected.
- Add "Background image" → upload an image; Save; reopen → shows "Uploaded file".
- Run a compile in the Builder with a template that has music + an image background; confirm the output plays the looped music and shows the background.

- [ ] **Step 8: Commit** (request consent first)

```bash
git add apps/le-clap-web/src/presentation/components/admin/TemplateEditor.tsx
git commit -m "feat(web): wire music and background-image pickers into the template editor"
```

---

### Task 9: Credits, docs, and final verification

**Files:**
- Create: `apps/le-clap-web/public/CREDITS.txt`
- Modify: `README.md` and/or `AGENTS.md` (Web App section)

- [ ] **Step 1: Write CREDITS.txt**

Create `apps/le-clap-web/public/CREDITS.txt` listing every curated asset with title, author, license, and source URL (one block per `MUSIC_LIBRARY` / `BACKGROUND_LIBRARY` entry). Keep it in sync with `mediaCatalog.ts`.

- [ ] **Step 2: Document the feature**

Add a short note to the Web App section of `README.md` (and `AGENTS.md` if it documents web features): templates can carry background music and a background image, chosen by upload (stored locally in IndexedDB) or from a curated, credited list; music loops to the video length in-browser.

- [ ] **Step 3: Full verification**

Run, in order:
- `pnpm test` — all suites pass (core: fetch + wasm-loop; web: catalog, media store, editor model, materialize).
- `pnpm lint` — 0 errors / 0 warnings.
- `pnpm --filter le-clap build` — succeeds.
- `pnpm --filter @ffmpeg-video-composer/core build` (if a core build script exists) — succeeds.

- [ ] **Step 4: Commit** (request consent first)

```bash
git add apps/le-clap-web/public/CREDITS.txt README.md AGENTS.md
git commit -m "docs(web): credit curated media and document template media feature"
```

---

## Self-review notes (coverage vs. spec)

- Music global track → Task 5 (`global.music`), Task 8 (toggle + picker), Task 2 (looping). ✓
- Background as `image_background` section → Task 5 (build/rehydrate), Task 8 (button + body). ✓
- Upload → IndexedDB, separate store, survives clear() → Task 4. ✓
- Curated catalogs + credits + self-hosting → Task 3, Task 9. ✓
- `media://` sentinel + materialize + `fetch()` local-path → Task 6, Task 1. ✓
- Testing gates, React Compiler, a11y, lint 0/0 → embedded in each task + Task 7 Step 3 + Task 9. ✓
- Type consistency: `MediaChoice`, `MediaCredit`, `MediaSource`/`MediaTarget`, `BrowserMediaStore` signatures referenced consistently across Tasks 4–8. ✓
</content>
