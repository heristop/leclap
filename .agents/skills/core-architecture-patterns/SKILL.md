---
name: core-architecture-patterns
description: Use when adding a segment type, platform adapter, editor manager, core service, or descriptor effect (look/grade/motion/section-audio field) in packages/ffmpeg-video-composer, or when wiring new dependencies into the tsyringe container.
---

# Core Architecture Patterns

## Overview

`packages/ffmpeg-video-composer` is built from a few repeating patterns: **adapters** abstract the platform, the **PlatformBridge** selects them at runtime, **tsyringe DI** wires everything, and a **director → builder → segments → managers** pipeline compiles a template. Follow these patterns; reuse existing pieces before adding new ones. Full design: `docs/architecture.md`.

## The pipeline

`TemplateDirector` (`packages/ffmpeg-video-composer/src/director/TemplateDirector.ts`) orchestrates:
init → build each section → concat → apply music.

- Sections created by `SegmentFactory` (`editor/factories/SegmentFactory.ts`) → rendered by `*Segment` classes (`editor/segments/`).
- FFmpeg commands assembled by editor **managers** (`editor/managers/`): asset, variable, map, filter, formatter.
- `VideoEditor` concatenates; `MusicComposer` mixes audio.

## Adding a segment type

1. Add the section schema variant in `packages/ffmpeg-video-composer/src/schemas/template.schemas.ts` (extend `BaseSectionSchema`, add to the `SectionSchema` discriminated union).
2. Create `editor/segments/<Name>Segment.ts` following an existing segment (e.g. `VideoSegment.ts`); use `@injectable()`.
3. Register it in `editor/factories/SegmentFactory.ts` (map the new `type` literal → class).
4. Add a test under `packages/ffmpeg-video-composer/tests/`.

## Adding a descriptor effect

A structured-sugar effect (a `look`/`grade`/`motion`/section-audio field — not a raw `filters[]` escape hatch) follows this recipe end to end, proven across Phases 1-4 (LUT looks, chroma key, overlay motion, grain, letterbox, stylized looks, shake/pulse, `audioEffect`):

1. **Schema field** — add the field/variant in `packages/ffmpeg-video-composer/src/schemas/*.schemas.ts` (`effects-visual.schemas.ts` for `GradeSchema`/`LOOK_PRESETS`/`MotionEffectSchema`; `section.schemas.ts` for section-level fields like `letterbox`/`audioEffect`); update `src/core/descriptor-visual.d.ts` types. Every field keeps a `.describe()` — it feeds `docs/template-descriptor.schema.json`.
2. **Preset / lowering fn** — a pure `*ToFilters` function or a `LOOK_TABLE`/`MOTION_HANDLERS` row in `src/editor/presets/` (`looks.ts`, `motion.ts`). LGPL discipline: never emit `eq`/`geq`/`boxblur`; reuse `eqValueToLutyuv` for eq-equivalent maths on the LGPL engine. A section-audio effect instead extends the `-af` chain builder beside `audio-fade.ts`.
3. **Registry entry** — wire the compiler into `SUGAR_COMPILERS` in `src/editor/presets/registry.ts` (ordered `layers → motion → grade → look → letterbox → caption → titleCard → lowerThird` — pick an `order` between the neighbours it must sit next to), a `LOOK_TABLE` row, or a `MOTION_HANDLERS` entry.
4. **Tests** — TDD: exact command-string/filter-array assertions first, in the matching suite (`tests/looks.test.ts`, the motion or audio-fade tests). Then a real-compile fixture: JSON under `packages/ffmpeg-video-composer/tests/fixtures/` + an id added to `effects-fixtures.test.ts`'s `FIXTURES` array (validates against the schema AND smoke-compiles through the Node engine — rc 0).
5. **LGPL audit** — any new FFmpeg filter name goes into BOTH `ENGINE_EMITTED_FILTERS` (`src/editor/utils/filter-compat.ts`) AND the `--enable-filter=` list in `scripts/ffmpeg/common.sh`; `tests/lgpl-filter-audit.test.ts` cross-checks the two and fails the build if they drift.
6. **Regen** — `pnpm --filter ffmpeg-video-composer generate:schema` (writes `docs/template-descriptor.schema.json`) and `generate:capabilities`, in the same commit as the schema change.
7. **Builder exposure** — a `FEATURE_CONTROLS` entry in `packages/leclap-creative-kit/src/editor/control-metadata.ts`. If the field is new on the creative-kit section model (not already flowing through an existing inferred type like `Grade`/`MotionEffect`), also wire `model.ts` / `build-descriptor-fragments.ts` / `to-editor-state.ts` for build/rehydrate round-tripping. Then the web panel (`apps/leclap-web/src/presentation/components/admin/editor/*Panel.tsx`) + Expo panel (`apps/leclap-expo/src/features/templates/components/*Fields.tsx`) + i18n keys in all five locales, in both apps.
8. **Docs** — add the field to `docs/template-configuration.md` in the same commit as the schema regen (this is the field reference authors read; `authoring-video-templates/SKILL.md` links to it).
9. **Device rebuild** — a NEW FFmpeg filter (not just a descriptor field reusing filters already shipped) needs the on-device engines rebuilt before it works in the app: `scripts/ffmpeg/build-engine.sh android` then `ios` (sequential, never concurrent). The LGPL audit only proves the filter _can_ run on the LGPL config — the currently-shipped `.so`/xcframework binaries don't have it until they're rebuilt.

## Adding a platform adapter

1. Implement the matching `Abstract*` base in `packages/ffmpeg-video-composer/src/platform/<capability>/` (e.g. `AbstractFFmpeg`, `AbstractFilesystem`, `AbstractLogger`). Name it `<Thing><Platform>Adapter`.
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
- Validate with `pnpm --filter ffmpeg-video-composer exec tsc --noEmit`, then `pnpm test` and `pnpm lint`.

## Common mistakes

- Adding a segment to the factory but forgetting the schema union (or vice versa) → validation/runtime mismatch.
- Importing a Node-only module from code that also runs in the browser bundle (`browser.ts` path) — put it behind an adapter.
- Forgetting to register a new adapter in `PlatformBridge` for every runtime it should serve.
