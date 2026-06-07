# Template media: music + background image (upload or curated list)

- Date: 2026-06-07
- Status: approved (design); plan pending
- Area: `apps/le-clap-web` (template editor + compile path), `packages/core` (browser FS adapter, WASM music looping)

## Goal

In the web "create template" flow, let the author attach:

1. A background **music** track — upload a file or pick from a curated royalty-free list (with credits).
2. A background **image** — upload a file or pick from a curated Unsplash list (with credits).

Both feed the existing in-browser FFmpeg compile so the composed video plays the chosen music and shows the chosen background.

## Decisions (settled with the user)

- **Music is one global track**, not per-section. It maps to `global.music` and is gated by the existing "Background music" toggle.
- **Background is an `image_background` section**. A new "Background image" entry joins the Add-section row (`Your video / Form fields / Color background`).
- **Uploads persist in IndexedDB** (the same store the engine already reads), referenced by a stable path in the descriptor. Curated picks store a same-origin URL. Uploaded media stays on the device; it is not embedded in the exported template JSON. A missing blob surfaces a clear "re-upload" error.
- **In-browser music looping is implemented** as part of this work (no longer a stub), so music covers videos longer than the track.

## Data model (no core schema changes)

Reuses fields already in the core schema, so stored descriptors stay compile-valid.

- Music: `global.music = { name, url? }` and `global.musicEnabled = true`.
  - Curated pick: `{ name: <id>, url: <same-origin /musics/...> }`.
  - Upload: `{ name: <key> }` where the blob lives at `/assets/musics/<key>.mp3` in IndexedDB. `loadMusic()` cache-hits on that path through `stat()`, so no fetch is needed.
- Background: an `image_background` section, `{ name: 'image_N', type: 'image_background', options: { pictureUrl, duration } }`.
  - Curated pick: `pictureUrl = <same-origin /backgrounds/...>`.
  - Upload: `pictureUrl = /assets/pictures/<key>.<ext>`, blob stored at that path in IndexedDB.

The editor models each choice as a small union and resolves it to the descriptor on save:

```ts
type MediaChoice = { source: 'library'; id: string } | { source: 'upload'; key: string; ext: string; label: string };
```

## Curated catalogs (self-hosted)

Self-host a small set under `public/` so the WASM engine fetches them same-origin (no CORS or hotlink failure at compile), and offline works.

- `public/musics/*.mp3` — about 5 CC0 / Pixabay-Music tracks.
- `public/backgrounds/*.jpg` — about 6 Unsplash photos.
- `src/data/musicLibrary.ts`, `src/data/backgroundLibrary.ts` — entries of `{ id, title, artist | photographer, url, credit, license, licenseUrl }`.
- `public/CREDITS.txt` plus inline attribution per item ("Photo by X on Unsplash", "Track by Y, CC0").

Sourcing happens during implementation: download the files, record exact titles, authors, license, and source URLs in the catalog data and `CREDITS.txt`.

## Upload persistence

`coreCompilationService.compileVideo` calls `filesystemAdapter.clear()` at the start of every compile, which wipes the engine's IndexedDB store. Uploaded media therefore lives in a **separate IndexedDB** (`leclap-media` / `media`) so it survives across edits, reloads, and compiles.

`browserMediaStore` is a pure class over an injected `MediaBackend` interface (the small slice of IndexedDB it needs), wired in the app with a real IndexedDB backend and mocked in tests. This follows the existing `UserTemplateService` pattern (inject `Storage`) so no `fake-indexeddb` dependency is required for its tests.

- `save(file, kind): Promise<{ key, ext }>` — store the blob + metadata (kind, ext, original name) under a generated `key`.
- `getBytes(key): Promise<Uint8Array | null>` and `getMeta(key)` — read the blob/metadata for compile-time materialize.
- `previewUrl(key): Promise<string | null>` — `URL.createObjectURL(blob)` for `<audio>` / `<img>`.
- `remove(key)` — drop a blob when a choice is cleared or replaced.

The descriptor never stores raw bytes. An uploaded choice is referenced by a `media://<key>` sentinel string (`global.music.url` for music, `options.pictureUrl` for an image section). Curated choices store a real same-origin URL instead.

## Compile-time resolution

Curated picks store a real same-origin URL in the descriptor and flow through the engine's existing fetch path unchanged (`/musics/...` and `/backgrounds/...` are served from `public/`).

Uploads carry a `media://<key>` sentinel that the engine cannot read, and the persisted blobs live in a separate store. So `coreCompilationService.compileVideo` gains a **materialize step** that runs after `filesystemAdapter.clear()` and before compile:

1. Walk the descriptor. For each `media://<key>` reference (in `global.music.url` or an `image_background` section's `options.pictureUrl`), read the blob from `browserMediaStore` and write it into the engine filesystem:
   - music → `/assets/musics/<key>.mp3`, then rewrite `global.music` to `{ name: <key> }` (drop the sentinel) so `loadMusic()` cache-hits via `stat()`.
   - image → `/assets/pictures/<key>.<ext>`, then rewrite `pictureUrl` to that path.
2. A missing blob throws a clear error ("Uploaded music/background is no longer available — re-select it in the template").

The image path still needs one engine change, because `AssetManager.fetchSingleAsset` routes a local `/`-path through `BrowserFilesystemAdapter.fetch()`, which calls `window.fetch` and cannot read a virtual IndexedDB path:

> `BrowserFilesystemAdapter.fetch(url)`: if `url` starts with `/` and `exists(url)` is true, copy it to `/tmp/fetch/<name>` and return that path (matching the HTTP branch) instead of calling `window.fetch`.

This mirrors how uploaded videos already use `/tmp/...` paths, is small and unit-testable, and does not affect HTTP fetches. Music needs no such change (its lookup uses `stat()` + adapter reads, never `fetch()`).

## Music looping (WASM)

`MusicWasmAdapter.process()` is currently a no-op. Implement it to match `MusicNodeAdapter`'s behaviour using the WASM FFmpeg instance:

1. Resolve the FFmpeg adapter from the tsyringe container (the same pattern `MusicComposer` uses to resolve `musicAdapter`).
2. Probe the track duration via the adapter's `getInfos` (verify it exposes duration during planning; otherwise parse from the run log).
3. If `musicLength < totalLength`, loop the track to cover `totalLength` and write the result back to `musicPath` in IndexedDB. Prefer `-stream_loop -1 -i <music> -t <totalLength> -c copy <loop>` then move `<loop>` over `musicPath`; fall back to the `concat:` approach if `-c copy` misbehaves in WASM.
4. Return `{ rc: 0 }`; on failure log and throw, as the Node adapter does.

This runs in `VideoEditor.finalize()` before `appendMusic` mixes the (now long-enough) track.

## UI (built with the impeccable and ui-ux-pro-max skills)

- `MediaPicker` — one reusable control with an Upload / Library segmented switch.
  - Upload tab: a dropzone following the existing `FileUpload` pattern, with size guidance.
  - Library tab: a grid of cards, each with an inline preview (audio play/pause for music, thumbnail for images) and a credit line.
  - Emits a `MediaChoice` and shows the current selection with a clear/replace affordance.
- Music: the "Background music" toggle reveals the music `MediaPicker` (global, in `MetadataFields`).
- Background image: a new "Background image" button in `AddSectionButtons`; its section row renders a background `MediaPicker` plus a duration field, mirroring the Color section's color + duration layout.

## Editor model wiring (`templateEditorModel.ts`)

- `EditorState` gains `music?: MediaChoice` (used when `musicEnabled`).
- `EditorSection` gains `{ kind: 'image'; background: MediaChoice; duration: number }`; `SECTION_LABELS`, `newSection`, and `SectionIcon` get the `image` case.
- `buildDescriptor`: emit `global.music` from `state.music`; emit an `image_background` section from each image section, numbering them `image_1`, `image_2`, ….
- `toEditorState`: rehydrate `global.music` and `image_background` sections back into `MediaChoice` (match a `pictureUrl`/`url` to a library id, else treat as an upload key).

## File-by-file changes

New:

- `apps/le-clap-web/src/data/musicLibrary.ts`, `src/data/backgroundLibrary.ts`
- `apps/le-clap-web/src/stores/browserMediaStore.ts` (+ service wiring under `src/services/`)
- `apps/le-clap-web/src/presentation/components/admin/MediaPicker.tsx`
- `apps/le-clap-web/public/musics/*.mp3`, `public/backgrounds/*.jpg`, `public/CREDITS.txt`

Changed:

- `apps/le-clap-web/src/presentation/components/admin/TemplateEditor.tsx` (music picker in `MetadataFields`, image button in `AddSectionButtons`, image branch in `SectionFields`)
- `apps/le-clap-web/src/presentation/components/admin/templateEditorModel.ts` (model + build/rehydrate)
- `apps/le-clap-web/src/application/usecases/coreCompilationService.ts` (only if a touch-up is needed once verified)
- `packages/core/src/platform/filesystem/BrowserFilesystemAdapter.ts` (`fetch` local-path short-circuit)
- `packages/core/src/platform/ffmpeg/MusicWasmAdapter.ts` (loop implementation)

## Testing

- `musicLibrary` / `backgroundLibrary`: ids unique, files present, credit fields filled.
- `templateEditorModel`: build then rehydrate round-trip for a template carrying global music and an image section.
- `browserMediaStore`: save then previewUrl then remove (fake IndexedDB).
- `BrowserFilesystemAdapter.fetch`: returns a local path directly when it exists; still fetches HTTP URLs.
- `MusicWasmAdapter.process`: loops when `musicLength < totalLength`, no-ops when long enough (mock the FFmpeg adapter).
- Gates: `pnpm lint` 0/0, `pnpm --filter le-clap-web build` green, React Compiler stays on (no manual memo), a11y on the picker tabs, cards, audio control, and dropzone.

## Risks and caveats

- Uploaded media is device-local (IndexedDB), not part of exported template JSON. Accepted.
- IndexedDB quota: large uploads add up. Show size guidance and surface quota errors.
- WASM looping with `-c copy`: if stream copy produces a malformed mp3 in the WASM build, fall back to re-encoding or the `concat:` demuxer. Covered by the looping test.

## Out of scope

- Per-section music.
- Importing/exporting templates with embedded media.
- A general media library/manager beyond this picker.
  </content>
  </invoke>
