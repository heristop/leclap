---
name: core-architecture-patterns
description: Use when adding a segment type, platform adapter, editor manager, or core service in packages/core, or when wiring new dependencies into the tsyringe container.
---

# Core Architecture Patterns

## Overview

`packages/core` is built from a few repeating patterns: **adapters** abstract the platform, the **PlatformBridge** selects them at runtime, **tsyringe DI** wires everything, and a **director → builder → segments → managers** pipeline compiles a template. Follow these patterns; reuse existing pieces before adding new ones. Full design: `docs/architecture.md`.

## The pipeline

`TemplateDirector` (`packages/core/src/director/TemplateDirector.ts`) orchestrates:
init → build each section → concat → apply music.

- Sections created by `SegmentFactory` (`editor/factories/SegmentFactory.ts`) → rendered by `*Segment` classes (`editor/segments/`).
- FFmpeg commands assembled by editor **managers** (`editor/managers/`): asset, variable, map, filter, formatter.
- `VideoEditor` concatenates; `MusicComposer` mixes audio.

## Adding a segment type

1. Add the section schema variant in `packages/core/src/schemas/template.schemas.ts` (extend `BaseSectionSchema`, add to the `SectionSchema` discriminated union).
2. Create `editor/segments/<Name>Segment.ts` following an existing segment (e.g. `VideoSegment.ts`); use `@injectable()`.
3. Register it in `editor/factories/SegmentFactory.ts` (map the new `type` literal → class).
4. Add a test under `packages/core/tests/`.

## Adding a platform adapter

1. Implement the matching `Abstract*` base in `packages/core/src/platform/<capability>/` (e.g. `AbstractFFmpeg`, `AbstractFilesystem`, `AbstractLogger`). Name it `<Thing><Platform>Adapter`.
2. Register/select it in `PlatformBridge.ts` for the right runtime (Node / browser / React Native).
3. Wire it into the container at the entry point: `index.ts` (Node) or `browser.ts` (browser/WASM).

## Dependency injection (tsyringe)

```ts
@injectable()
class VideoEditor {
  constructor(@inject('ffmpegAdapter') private readonly ffmpeg: AbstractFFmpeg) {}
}

// at the entry point
container.registerInstance('ffmpegAdapter', await bridge.create('ffmpeg'));
```

- Use `@singleton()` for shared models/state, `@injectable()` for services.
- Register by string token in `index.ts` / `browser.ts`; resolve via `container` or constructor injection.
- `reflect-metadata` must be imported once at the entry point or all DI breaks at runtime.

## Conventions

- PascalCase class + file name; `Abstract*` bases; `*Adapter` implementations; `*Manager` for the editor layer.
- Keep platform-specific code behind an adapter — never branch on the runtime outside `PlatformBridge`.
- Validate with `pnpm --filter @ffmpeg-video-composer/core exec tsc --noEmit`, then `pnpm test` and `pnpm lint`.

## Common mistakes

- Adding a segment to the factory but forgetting the schema union (or vice versa) → validation/runtime mismatch.
- Importing a Node-only module from code that also runs in the browser bundle (`browser.ts` path) — put it behind an adapter.
- Forgetting to register a new adapter in `PlatformBridge` for every runtime it should serve.
