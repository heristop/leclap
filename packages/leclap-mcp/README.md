# @leclap/mcp

An [MCP](https://modelcontextprotocol.io) server that exposes the
[`ffmpeg-video-composer`](../ffmpeg-video-composer) engine as **agent-callable video tools**.

An AI agent (Claude Desktop, Cursor, …) is the LLM; this server helps it **author a customized
template with nice effects** from the schema, then validates and renders it **deterministically** to
an mp4. The server ships **no built-in template catalog** — it is decoupled from the app's
creative-kit — so it stays a generic authoring tool. Remotion-assisted authoring is a bonus path.
The result is _agent-composable, deterministic, reproducible_ video — the opposite of generative
(Sora/Runway). Design spec:
[`docs/superpowers/specs/2026-06-11-leclap-mcp-design.md`](../../docs/superpowers/specs/2026-06-11-leclap-mcp-design.md).

## Tools

| Tool                   | Description                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `get_template_schema`  | The JSON Schema for a template descriptor + a short authoring guide                                                       |
| `validate_template`    | Dry-run an inline descriptor (no render) → `{ valid, sectionCount, orientation, requiredClips, formFields }`              |
| `compose_video`        | Validate an inline descriptor and render → `{ outputPath, durationSeconds, sizeBytes, videoCodec, audioCodec, renderId }` |
| `probe_media`          | Inspect a local media file → codecs, duration, sample rate, size                                                          |
| `render_remotion_clip` | _(bonus, opt-in)_ Render a composition from **your own** Remotion project → an mp4 clip for a `project_video` section     |

Typical agent flow: `get_template_schema` → author an inline descriptor (optionally prepend a
`render_remotion_clip` intro) → `validate_template` (instant, iterate until valid) → `compose_video`
→ read the returned `outputPath`.

**Bring-your-own Remotion (optional).** If you have a Remotion project, `render_remotion_clip` renders
one of its compositions — genuine motion graphics (spring physics, kinetic typography) an FFmpeg
filtergraph can't express — to an mp4. Point it at your `entry` (the module that calls `registerRoot`)
or a prebuilt `serveUrl`, plus a `compositionId` and optional `inputProps`; or set a default with
`--remotion-entry` / `LECLAP_MCP_REMOTION_ENTRY`. Feed the returned clip to `compose_video` as a
`project_video` clip (via `userVideoPaths`) and the deterministic engine composites it in front of your
scenes. It needs the **optional peer deps** `@remotion/renderer` + `@remotion/bundler` and is
**design-time only** (headless Chromium) — everything else in the MCP stays self-contained and on-device.

### Prompt

`compose-video` — a guided authoring prompt (surfaces as `/compose-video` in clients like Claude
Desktop). Takes optional `goal` and `orientation` arguments and primes the agent with the schema,
the premium building-block recipes (which filters give which look, the bundled font list, the
on-device filter allowlist), and the `validate_template` → `compose_video` loop.

## Run

```bash
# build the engine + this server, then start it over stdio
pnpm --filter ffmpeg-video-composer build
pnpm --filter @leclap/mcp build
node packages/leclap-mcp/dist/index.js
```

It speaks MCP over **stdio** (stdout is the protocol channel — all diagnostics go to stderr).
The published `bin` is `leclap-mcp`.

### Configuration

| Setting         | Flag                  | Env                            | Default             |
| --------------- | --------------------- | ------------------------------ | ------------------- |
| Output dir      | `--output-dir`        | `LECLAP_MCP_OUTPUT_DIR`        | `~/.leclap/renders` |
| Media allowlist | `--media-dir`         | `LECLAP_MCP_MEDIA_DIR`         | `~` (home)          |
| Render timeout  | `--render-timeout-ms` | `LECLAP_MCP_RENDER_TIMEOUT_MS` | `600000` (10 min)   |

Each render writes to `<output-dir>/<renderId>/`. Local input files (`userVideoPaths`,
`probe_media`) must resolve **inside** the media-dir (symlink-safe containment check).

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (absolute paths only — env values are not tilde-expanded):

```json
{
  "mcpServers": {
    "leclap": {
      "command": "node",
      "args": ["/abs/path/to/ffmpeg-video-composer/packages/leclap-mcp/dist/index.js"],
      "env": {
        "LECLAP_MCP_OUTPUT_DIR": "/abs/path/to/Movies/leclap-renders",
        "LECLAP_MCP_MEDIA_DIR": "/abs/path/to/Movies"
      }
    }
  }
}
```

Then ask the agent to _"list the video templates, then render the sample template"_ and open the returned path.

### Inspector

```bash
npx @modelcontextprotocol/inspector node packages/leclap-mcp/dist/index.js
```

## Architecture

`compose_video` never runs the compile in the server process. The core logs to **stdout** during a
render (including pino writing directly to fd 1), which would corrupt the MCP JSON-RPC stream — so
the render runs in a **forked child worker** (`dist/render-worker.js`) and the result returns over
the **IPC channel**, never the child's stdout. This also gives clean error capture (the parent
buffers the worker's logs), render timeouts, and DI state isolation between renders.

Security is inherited from the core: FFmpeg runs via `execFile` (no shell); remote template URLs are
SSRF-guarded (private/metadata IPs + redirects blocked, http(s) only); descriptors are
`safeParse`-validated; local file paths are containment-checked against the media dir.

## Tests

```bash
pnpm --filter @leclap/mcp test              # vitest unit tests (mocked render)
pnpm --filter @leclap/mcp test:integration  # cucumber BDD over real stdio + a real render
```

The integration suite spawns the built server over stdio and renders a self-contained
color-card template end to end — the regression guard proving the stdio framing survives a
real (pino-heavy) compile.

## Not yet (future)

HTTP/SSE transport, MCP resources (`leclap://templates/{name}`), progress notifications,
remote-URL probing, an async job API. This package is structured tarball-clean but is not yet
published to npm.

---

Part of the [LeClap monorepo](../../README.md).
