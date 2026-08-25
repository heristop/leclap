# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `render_remotion_clip` now reports render progress on stderr. Remotion's per-frame callback is
  throttled to the same 2% step `compose_video` uses, so a long clip render prints roughly fifty
  `[render_remotion_clip] render <id> <n>%` lines instead of one per frame — a render that used to
  look hung now shows it is moving. Non-finite progress values are dropped rather than logged, so a
  missing figure can neither print `NaN%` nor disable the throttle for the rest of the render.
  stdout is untouched: it stays the JSON-RPC framing channel, and the tool's result payload is
  unchanged.

## [0.3.4] - 2026-08-24

### Changed

- The MCP registry name moves from `dev.leclap/mcp` to `dev.leclap/video`. The registry's
  `search` parameter matches the server **name** only — descriptions are not indexed, so
  `dev.leclap/mcp` was unreachable from the one query with real intent behind it. The domain
  proof already covers the whole `dev.leclap/*` namespace, so no DNS change is involved.

## [0.3.3] - 2026-08-24

### Changed

- The MCP registry name moves from `io.github.heristop/leclap` to `dev.leclap/mcp`, matching
  the project's own domain rather than a personal GitHub handle. `mcpName` is validated from
  the published tarball, which is why the rename needs a release.

### Added

- `bugs` now points at the issue tracker explicitly instead of being inferred from
  `repository`.

## [0.3.2] - 2026-08-15

### Fixed

- `ffmpeg-video-composer` is depended on by a plain semver range. 0.3.0 and 0.3.1 shipped the
  literal string `workspace:*` — npm publishes it verbatim, so both releases fail to install
  with `EUNSUPPORTEDPROTOCOL`. Use 0.3.2 or later.
- `serverInfo.version` reports the real published version rather than a stale constant.

## [0.3.1] - 2026-08-15

### Fixed

- `validate_template` and `compose_video` now run the engine's full `TemplateValidator`
  (schema plus section-reference, transition, motion, animation, watermark, and font rules)
  with partials expanded first — a template can no longer validate clean and then fail
  mid-render, and a `project_video` living inside a partial now surfaces in
  `requiredClips` and the clip-coverage checks.
- `compose_video` passes the configured media dir as the engine's assets root, so
  descriptor asset paths under `LECLAP_MCP_MEDIA_DIR` resolve during renders — they were
  rejected as "outside the staged media directories" while `probe_media` accepted the
  same paths.
- The `probe_media` ffprobe fallback is honest: the name-swapped `ffmpeg-static` path is
  existence-checked (the package ships no ffprobe) and a missing binary yields an
  actionable install message instead of a raw spawn error.

### Changed

- The README documents the real media allowlist default (`~/.leclap/media`, not the home
  directory) and the `--allow-remotion` / `LECLAP_MCP_ALLOW_REMOTION` opt-in that gates
  `render_remotion_clip`.

## [0.3.0] - 2026-08-13

### Added

- `compose_video` now returns a `resource_link` alongside its text and structured
  content — a `file://` URI for the rendered `video/mp4`. Clients open or fetch the
  file themselves instead of the server inlining megabytes of base64 into the
  conversation.
- Render progress. The forked worker reports fractional progress over the IPC channel,
  throttled to 2% steps (the terminal 100% always gets through, exactly once), and
  `compose_video` writes it to **stderr** as `[compose_video] render <id> NN%`. It is
  not a protocol notification: the per-request log channel is deprecated in the
  2026-07-28 revision, which names stderr as the replacement for stdio servers, and
  stdout remains reserved for JSON-RPC framing.

### Changed

- Migrated from the monolithic `@modelcontextprotocol/sdk` v1 to the split SDK v2
  (`@modelcontextprotocol/server`), which implements the
  [2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28) protocol
  revision — the stateless one, with `server/discover` in place of the `initialize`
  handshake. Clients still on a 2025-era revision keep working: the stdio entry serves
  both eras from the same tool definitions.
- `tools/list`, `prompts/list`, and `server/discover` now advertise cache hints
  (5-minute TTL, `private` scope) instead of the SDK's conservative `ttlMs: 0`. The
  tool surface is fixed for the process lifetime, so a real freshness window is
  correct; `private` because the listing depends on this server's configuration.
- Tool and prompt argument schemas are declared as `z.object(...)` (the raw-shape
  overload is deprecated in v2), and handlers now receive the v2 `ServerContext` —
  cancellation moved from v1's flat `extra.signal` to `ctx.mcpReq.signal`.

## [0.2.0] - 2026-07-24

### Security

- `compose_video` now contains the descriptor's raw filter chain before it reaches
  ffmpeg: file/URL-reading filter types (`movie`, `amovie`, `subtitles`, `ass`, and
  plugin loaders such as `frei0r`/`ladspa`) are rejected, as are file/URL tokens
  smuggled through a scalar filter `value` (e.g. `curves=psfile=/etc/passwd` or an
  `http://…` URL). This closes an arbitrary-file-read + SSRF escape past the media-dir
  sandbox that only the `userVideoPaths` inputs were previously guarded against.

### Changed

- **Opt-in required:** `render_remotion_clip` — which bundles and executes
  caller-supplied code in headless Chromium — is now **disabled by default**. Enable it
  with `--allow-remotion` or `LECLAP_MCP_ALLOW_REMOTION=1` for trusted local design-time
  use. Callers of an existing server must add the flag for the tool to appear.
- `outputBaseName` on `compose_video` is now honoured, naming the output `.mp4`
  accordingly (previously validated but ignored).

### Fixed

- Forked render workers now have an `error` listener, so a spawn/IPC failure fails only
  that render instead of crashing the whole MCP server.
- The render worker flushes its IPC result before exiting, so a successful render is no
  longer reported as a failure.
- Concurrent renders are capped, client cancellation kills the worker immediately
  (freeing its slot), and intermediate render files are pruned to bound disk usage.
- `serveUrl` containment for `render_remotion_clip` is now realpath-based (symlink-safe),
  and `probe_media` plus the Remotion setup steps (`bundle`/`ensureBrowser`/
  `selectComposition`) are timeout-bounded.
- The stdout guard is installed before the engine's module graph loads, so a load-time
  write can no longer corrupt the JSON-RPC framing.

## [0.1.0] - 2026-06-27

Initial release: an MCP server exposing `ffmpeg-video-composer` as
agent-callable video composition tools.

### Added

- MCP tools for composing and rendering videos from JSON templates, plus a
  compose guide covering orientations (including square).
- Remotion clip rendering.

### Fixed

- Tightened local render access.
