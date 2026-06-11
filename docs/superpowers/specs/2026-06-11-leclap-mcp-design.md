# @leclap/mcp — MCP server design

- Date: 2026-06-11
- Status: approved (design)
- Area: new package `packages/mcp` (`@leclap/mcp`); consumes the built `ffmpeg-video-composer` core.

## Context

Agents are good at authoring structured JSON but bad at driving FFmpeg. `@leclap/mcp`
is a Model Context Protocol server that exposes the deterministic
`ffmpeg-video-composer` engine as agent-callable tools over stdio. The split of
responsibility is the whole point:

- **The agent (the LLM)** authors / edits a template descriptor (JSON) and picks media.
- **The MCP server** validates that JSON against the core's zod schema and renders it.
- **No LLM runs inside the server.** Rendering is fully deterministic: the same template
  with the same media yields the same video. The server is a thin, typed, safe adapter
  over `compile()`.

This lets any MCP-capable agent (Claude Desktop, Claude Code, etc.) compose real
videos from a JSON spec without learning FFmpeg, while the heavy, side-effectful work
stays in a vetted, schema-guarded boundary.

## Load-bearing constraint: stdio is the JSON-RPC channel

An MCP stdio server speaks JSON-RPC over **fd 1 (stdout)**. Anything else that writes to
fd 1 corrupts the protocol and breaks the session. The core is not stdout-clean:

- `PinoLogAdapter` uses `pino()`, which writes to fd 1 by default.
- `compile()` itself calls `console.log` / `console.error` on the happy path and on errors.

Therefore **`compile()` must never run in the MCP server's own process.** It runs in a
**forked child worker** (`render-worker.js`); the worker owns fd 1/fd 2 freely, and the
parent receives only structured results over **IPC** (`child_process.fork`). The parent's
own stdout stays reserved for JSON-RPC. As defense in depth, the parent also installs a
**stdout guard** at startup (route stray writes to fd 2) so a stray `console.log` in any
dependency can't poison the channel.

## Tool surface (5 tools)

| Tool                  | Kind        | Purpose                                                                   |
| --------------------- | ----------- | ------------------------------------------------------------------------- |
| `list_templates`      | read-only   | List the bundled templates (id, title, short description, orientation).   |
| `get_template`        | read-only   | Return one bundled template's full JSON descriptor by id.                 |
| `get_template_schema` | read-only   | Return the JSON Schema for a template descriptor (agent authoring aid).   |
| `compose_video`       | side-effect | Validate a descriptor + media, render via the worker, return output path. |
| `probe_media`         | read-only   | Probe a media file (duration/resolution/codec) to inform authoring.       |

`compose_video` is the only mutating tool; the other four are pure reads that help the
agent author a valid descriptor before it commits to a render.

## Key sub-decisions

- **Catalog by codegen, not runtime import.** The published core ships only `dist` — the
  bundled template JSONs and library catalog under `src/shared/` are **not** in the
  package's runtime entry. A small build-time codegen step snapshots the bundled
  templates into the MCP package so `list_templates` / `get_template` work against the
  installed core without reaching into `src`. (Implemented in a later task.)
- **Schema source of truth.** `get_template_schema` derives from the core's exported
  `TemplateDescriptorSchema` (zod) → JSON Schema; `compose_video` validates the incoming
  descriptor with the same schema before forking the worker. One schema, two uses.
- **Output location.** Renders default to `~/.leclap/renders` (created on demand). The
  caller may override via config/env. Stable, user-owned, outside the repo.
- **Media-dir path guard.** `compose_video` / `probe_media` only accept media paths inside
  an allow-listed media directory (configurable; defaults sensibly). Paths are resolved
  and checked to prevent traversal (`..`) and reads outside the sandbox.
- **Stdout guard.** At startup the server redirects any direct fd-1 writes to fd 2, so a
  stray log line from a transitive dependency cannot corrupt JSON-RPC framing.
- **Worker IPC contract.** The parent forks `render-worker.js`, sends the project config
  and template descriptor, and awaits a single result message
  (`{ ok, outputPath }` or `{ ok: false, error }`). The worker imports the
  **already-compiled core dist** (no decorators compiled in the MCP package itself).

## Architecture sketch

```
agent ──JSON-RPC/stdio──> McpServer (parent)
                            │  stdout guard (fd1→fd2)
                            │  zod validate (TemplateDescriptorSchema)
                            └─fork─> render-worker.js ──> core compile() ──> video file
                                       (owns fd1/fd2)        (~/.leclap/renders)
                            <──IPC result {ok,outputPath}──┘
```

## Out of scope

- No LLM, prompt, or generation logic inside the server (the agent authors JSON).
- No HTTP/SSE transport in this iteration — **stdio only**.
- No streaming progress events (single request → single result for now).
- No template authoring UI, no persistence/DB, no auth (local stdio trust model).
- No new rendering features in the core — the MCP is a pass-through to `compile()`.

## Build & conventions

- pnpm 11 workspace package under `packages/*`, scope `@leclap/*`, Node ≥ 24.11.
- Built with **tsdown** (two entries: `index.ts` → CLI bin, `worker/renderWorker.ts` →
  `render-worker.js`), tested with **vitest**, typechecked with `tsc --noEmit`.
- Depends on `@modelcontextprotocol/sdk` (high-level `McpServer` API) and the workspace
  `ffmpeg-video-composer` core. zod `^4` (SDK 1.29 supports zod 3.25+/4).
- No `else`/`eslint-disable`; lowercase conventional commits; lint via root `pnpm lint`.
