# Contributing

Thanks for your interest in improving **ffmpeg-video-composer** (the `leclap` monorepo). This guide covers local setup, the day-to-day workflow, and how to get a change merged.

## Prerequisites

The toolchain is pinned via [`mise`](https://mise.jdx.dev/) (Node 24, pnpm 11, Rust stable, and a full FFmpeg build). With `mise` installed:

```bash
mise install     # installs Node, pnpm, Rust, FFmpeg at the pinned versions
pnpm install     # installs workspace dependencies
```

`engine-strict` rejects the wrong Node version, so use the pinned toolchain rather than a system install.

### Just want to fix something in the engine?

You do not need Rust, Expo, or the on-device toolchain. The engine and its 77 test files run on
Node plus any system FFmpeg:

```bash
git clone --filter=blob:none https://github.com/heristop/leclap.git   # ~7 MB of .git, not ~310 MB
cd leclap
pnpm install
bash scripts/ci/fetch-test-media.sh   # render fixtures: videos, music, overlays (~145 MB)
bash scripts/ci/fetch-web-media.sh    # video_3/video_4, which two director suites also render
pnpm --filter ffmpeg-video-composer build   # dist/, read by the diagnose and build-output suites
pnpm --filter ffmpeg-video-composer test
```

Every step above is load-bearing. The render suites decode real media that a clone does **not** carry:
the checkout leaves Git LFS pointer files, and FFmpeg rejects those with `moov atom not found`. The
scripts pull the same digest-pinned bundles CI uses, over plain HTTPS rather than `git lfs pull` —
this repository's LFS bandwidth budget is exhausted, so LFS downloads return 403. Drop a step and the
suite goes red: 81 of 1412 tests with no media at all, 49 with the test bundle but no build, and 2
with both (the `video_3.mp4` those two director suites render is covered by the web manifest, not the
test one).

`--filter=blob:none` fetches file contents lazily, which is worth doing here: the repository carries
rendered media in its history. The whole sequence took 3m23s on a fast connection — mostly the
~350 MB of media and the two-minute render suite. Rust is needed only for `packages/ffmpeg-engine`,
and Expo only for `apps/leclap-expo` — neither is required to change the engine, the CLI, or the MCP
server.

Looking for somewhere to start? The
[good first issues](https://github.com/heristop/leclap/issues?q=is%3Aopen+label%3A%22good+first+issue%22)
are scoped so that none of them requires the on-device toolchain.

## Repository layout

This is a pnpm-workspace monorepo (`apps/*`, `packages/*`). The full layout, architecture, and conventions live in **[AGENTS.md](./AGENTS.md)** — read it first; it is the single source of truth.

In short:

- `packages/ffmpeg-video-composer` — the published composition library (Node + browser/WASM).
- `packages/ffmpeg-engine` — Rust + uniffi on-device FFmpeg engine.
- `apps/leclap-web` — React + Vite web app (in-browser WASM).
- `apps/leclap-expo` — Expo / React Native app.

## Common commands

Run from the repo root unless noted. Tooling is **vite-plus (`vp`)** plus **oxlint** — there is no eslint, prettier, or root-level jest.

| Task            | Command                                   |
| --------------- | ----------------------------------------- |
| Lint (oxlint)   | `pnpm lint`                               |
| Format          | `pnpm fmt` (check only: `pnpm fmt:check`) |
| All checks      | `pnpm check`                              |
| Test (vitest)   | `pnpm test`                               |
| Build (tsdown)  | `pnpm build`                              |
| Typecheck a pkg | `pnpm --filter <pkg> exec tsc --noEmit`   |

Please make sure `pnpm test`, `pnpm lint`, and `pnpm build` pass before opening a PR.

## Building the on-device engine

The native FFmpeg engine binaries are **not committed**; build them from source:

```bash
scripts/ffmpeg/build-engine.sh
```

Build-environment notes live in [`docs/on-device-compilation.md`](./docs/on-device-compilation.md). You only need this when working on `apps/leclap-expo`'s on-device compile path.

## Commit convention

Commits follow **Conventional Commits** with a **lowercase**, single-line subject:

```text
fix(expo): real bundle id and env-driven api url
feat(core): add intertitle segment
docs: add contributing guide
```

Use scopes that match the package/app (`core`, `expo`, `web`, `engine`, `mcp`). Keep each commit focused and path-limited.

## Pull requests

1. Branch off `main`.
2. Make focused commits following the convention above.
3. Run `pnpm test`, `pnpm lint`, and `pnpm build`; format with `pnpm fmt`.
4. Open a PR using the [pull request template](./.github/pull_request_template.md), describing the change, the testing done, and any docs updated.

Pre-commit hooks (vite-plus staged checks) run `vp fmt` and `vp lint` on staged files automatically.

## Releasing

Releases are manual, on purpose. Nothing decides a version for you and no bot opens a release PR —
bumping a version is a deliberate act, reviewed like any other change.

Three packages are published and versioned independently: `ffmpeg-video-composer`, `@leclap/cli`,
and `@leclap/mcp`. The apps and shared kits are private and never published.

When a PR changes a published package, bump it in the same PR:

1. Raise the `version` in that package's `package.json`, following semver.
2. Add the entry to that package's `CHANGELOG.md`, newest first. The format is
   [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) — a `## [x.y.z] - YYYY-MM-DD` heading
   with `### Added` / `### Changed` / `### Fixed` sections. Write it for consumers, not for us.
3. If nothing user-facing changed in a published package, bump nothing. Not every PR is a release.

Once merged, publish by running the [Release workflow](./.github/workflows/release.yml) from the
Actions tab (**Actions → Release → Run workflow**). It builds the three packages and runs
`pnpm release`. Publishing needs an `NPM_TOKEN` repository secret.

`pnpm publish` skips any version already on the registry, so running the workflow with nothing
bumped is a no-op rather than an error — safe to press when you are unsure whether a release went
out.

To publish from a checkout instead, `pnpm release` does the same thing. Use `pnpm`, never a bare
`npm publish`: the published packages depend on `ffmpeg-video-composer` by plain semver range, and
`npm` ships pnpm's `workspace:*` protocol to the registry verbatim, producing a release that cannot
be installed at all. `tests/repo/package-metadata.test.ts` pins the range so a regression fails CI
rather than the registry.

### Prereleases (beta)

Publish a prerelease by giving it a prerelease version and a dist-tag, so it never becomes
`latest`:

```bash
# in the package: set "version": "2.0.0-beta.1", then
pnpm --filter ffmpeg-video-composer publish --tag beta --access public
```

Consumers opt in with `pnpm add ffmpeg-video-composer@beta`. Promote a beta by publishing the
stable version normally.
