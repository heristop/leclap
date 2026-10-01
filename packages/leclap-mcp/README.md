# @leclap/mcp

An [MCP](https://modelcontextprotocol.io) server that exposes the
[`ffmpeg-video-composer`](../ffmpeg-video-composer) engine as **agent-callable video tools**.

An AI agent (Claude Desktop, Cursor, …) is the LLM; this server helps it **author a customized
template with nice effects** from the schema, then validates and renders it **deterministically** to
an mp4. The server ships **no built-in template catalog** — it is decoupled from the app's
creative-kit — so it stays a generic authoring tool. Remotion-assisted authoring is a bonus path.
The result is _agent-composable, deterministic, reproducible_ video — the opposite of generative
video models, which sample rather than render.

## Tools

| Tool                   | Description                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `get_template_schema`  | The JSON Schema for a template descriptor + a short authoring guide                                                                                          |
| `validate_template`    | Dry-run an inline descriptor (no render) → `{ valid, sectionCount, orientation, requiredClips, formFields, geometry? }`                                      |
| `compose_video`        | Validate an inline descriptor and render → `{ outputPath, durationSeconds, sizeBytes, videoCodec, audioCodec, renderId }`, plus a `resource_link` to the mp4 |
| `probe_media`          | Inspect a local media file → codecs, duration, sample rate, size                                                                                             |
| `render_remotion_clip` | _(bonus, opt-in)_ Render a composition from **your own** Remotion project → an mp4 clip for a `project_video` section                                        |
| `ping`                 | Liveness check                                                                                                                                               |

Typical agent flow: `get_template_schema` → author an inline descriptor (optionally prepend a
`render_remotion_clip` intro) → `validate_template` (instant, iterate until valid) → `compose_video`
→ read the returned `outputPath`.

`validate_template` also reports, render-free, text that would run off the frame or out of title-safe,
collide with other text, sit under a band, be too small, lack contrast, or sit over footage with no box,
outline or shadow. Those findings arrive on the optional `geometry` field — one line each, saying what to
change, and the field is absent entirely when there is nothing to fix. They are advisory: `valid` stays
`true`. A line ending `(approx: …)` says why it is an estimate: the font could not be read, the text
carries a `{{ variable }}` that only resolves at render time, or a section declares no duration. When a
font is not bundled, the server fetches it from the LeClap asset catalog (5s timeout); offline, it
estimates.

Pass `render: true` to `validate_template` to also render the sections that hold text and measure
their contrast from real pixels — it settles text over images, grades and looks that the render-free
check can only call unknown. It costs seconds (two renders of those sections), goes through the same
media-dir sandbox as `compose_video`, reads assets from the media dir, and runs in the same forked
render worker under the same timeout. It adds a `render` field (`measured`, `seconds`, and
`unavailable` when it could not render — no FFmpeg with `drawtext`, a failed render, or a timeout);
the render-free findings come back either way.

### Recipe: video evidence for a pull or merge request

An agent working on a code change can use LeClap to package visual evidence for review:

1. Collect a short, real screen recording and state what the reviewer should inspect.
2. Author or reuse a review template such as [`examples/agentic-pr-video`](../../examples/agentic-pr-video), or its
   [evidence-video skill](../../examples/agentic-pr-video/evidence-skill), which composes before/after cards and panels
   with measured captions first.
3. Call `validate_template` until the descriptor is valid.
4. Call `compose_video` with the recording in `userVideoPaths` and the review context in `fields`.
5. Attach the returned `outputPath` to the PR or MR beside the diff.

The MCP server renders and returns a local artifact. It **does not upload to GitHub or GitLab**;
that remains an explicit step in the surrounding agent workflow.

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
# published — no checkout needed
npx -y @leclap/mcp
```

```bash
# or from a checkout: build the engine + this server, then start it over stdio
pnpm --filter ffmpeg-video-composer build
pnpm --filter @leclap/mcp build
node packages/leclap-mcp/dist/index.js
```

It speaks MCP over **stdio** (stdout is the protocol channel — all diagnostics go to stderr).
The published `bin` is `leclap-mcp`.

**FFmpeg.** `compose_video` renders with the engine's FFmpeg: system FFmpeg first, then the bundled
`ffmpeg-static`. `ffmpeg-static` ships no `ffprobe`. Templates with transitions, music, whole-video
overlays or `project_video` clips need one, and so does `probe_media`. On that path a render stops
before encoding and names the missing binary. Installing FFmpeg (`brew install ffmpeg`,
`sudo apt install ffmpeg`) provides both. The optional `ffprobe-static` package, installed next to
the server, also works.

Built on the [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
(`@modelcontextprotocol/server`), tracking the current protocol revision. Clients on an older revision
keep working — the stdio entry serves both eras from the same tool definitions.

### Configuration

| Setting         | Flag                  | Env                            | Default             |
| --------------- | --------------------- | ------------------------------ | ------------------- |
| Output dir      | `--output-dir`        | `LECLAP_MCP_OUTPUT_DIR`        | `~/.leclap/renders` |
| Media allowlist | `--media-dir`         | `LECLAP_MCP_MEDIA_DIR`         | `~/.leclap/media`   |
| Remotion opt-in | `--allow-remotion`    | `LECLAP_MCP_ALLOW_REMOTION`    | off                 |
| Render timeout  | `--render-timeout-ms` | `LECLAP_MCP_RENDER_TIMEOUT_MS` | `600000` (10 min)   |

Each render writes to `<output-dir>/<renderId>/`. Local input files (`userVideoPaths`,
`probe_media`) must resolve **inside** the media-dir (symlink-safe containment check). The
media-dir default is deliberately narrow — pointing it at `~` would let any tool call read the
whole home directory. `render_remotion_clip` executes your project's own JS, so it is registered
only when the opt-in is set (`--allow-remotion` or `LECLAP_MCP_ALLOW_REMOTION=1`); `leclap init
--remotion` scaffolds a `.mcp.json` with it enabled.

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (absolute paths only — env values are not tilde-expanded):

```json
{
  "mcpServers": {
    "leclap": {
      "command": "npx",
      "args": ["-y", "@leclap/mcp"],
      "env": {
        "LECLAP_MCP_OUTPUT_DIR": "/abs/path/to/Movies/leclap-renders",
        "LECLAP_MCP_MEDIA_DIR": "/abs/path/to/Movies"
      }
    }
  }
}
```

From a checkout, swap the command for `"command": "node"` with
`"args": ["/abs/path/to/ffmpeg-video-composer/packages/leclap-mcp/dist/index.js"]`.

Then ask the agent to _"compose a 10-second vertical title card with a fade-in and music, then render it"_ —
it fetches the schema, authors a descriptor, validates it, and renders. Open the returned `outputPath`.
(There is no catalog to list: the server authors templates rather than serving stock ones.)

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

`compose_video` returns a **`resource_link`** pointing at the rendered file rather than inlining
megabytes of base64 — the client opens or fetches it. Render progress is written to **stderr**
(`[compose_video] render <id> NN%`), not sent as a protocol notification: the per-request log channel
is deprecated in the current revision, and stdout is reserved for JSON-RPC framing.

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

Streamable HTTP transport, MCP resources (`leclap://templates/{name}`), client-visible progress
notifications, remote-URL probing, an async job API.

---

Part of the [LeClap monorepo](../../README.md).

## JSON-first registered effects

The opt-in desktop graphics backend can resolve `type: "effect"` sections directly from JSON before the existing FFmpeg pipeline compiles them. The first registered effect is `leclap.title-reveal@1.0.0`; configure a trusted Remotion entry exposing `LeclapTitle` (1280×720, 30 fps, 300 frames). [The runnable reference project](../../examples/llm-remotion-title) includes the component, JSON and media fixture generator.

- `get_effect_schema` returns the registered props, assets and runtime contract.
- `validate_template` checks references/props/assets and returns a content-based JSON revision.
- `render_preview` renders selected frames or an inclusive frame range from the effect scene; frame images are readable MCP image content.
- `patch_template` atomically applies selected effect props to inline JSON using an expected revision; it returns updated JSON without changing source or unrelated sections.
- `compose_video` resolves effect clips and sends the normalized template to the existing engine.

Remotion remains optional and requires the existing trusted-local opt-in. Set `LECLAP_MCP_REMOTION_BROWSER` / `--remotion-browser` to a compatible installed Chrome executable if you want to avoid browser setup downloads. Direct core compilation rejects unresolved effects before platform initialization. Library callers can use the exported `resolveTemplateEffects` callback API with their own trusted renderer.

This delivery supports opaque title clips. It does not execute React scenes on a phone, provide a general effect marketplace, or claim text-fit/contrast inspection of Remotion graphics through the core's FFmpeg geometry checks. Preserve JSON, module source/dependencies, assets and render provenance together for reproducibility.

Registered jobs run in a separate worker under one setup-and-render deadline. Failed jobs are removed. Completed previews retain returned artifacts and provenance; compositions retain provenance after the FFmpeg worker consumes the temporary effect clips. Intermediate paths in `effectProvenance` describe consumed inputs and are not downloadable output artifacts. Relative effect asset paths resolve under `mediaDir`; absolute paths must remain inside it. Effect props/assets must contain concrete values rather than unresolved `{{ placeholders }}`.

Registered JSON effect previews and composition reuse rendered artifacts in
`<mediaDir>/.leclap-effects/cache-v1`. Lookup happens after fresh asset staging,
bundling and browser/composition identification. Exact still frames, inclusive
ranges and full clips have separate keys; source, dependencies, props, assets and
render/browser settings participate in provenance. Hits are verified and copied
into the current job directory before use.

The default cache budget is 512 MiB with at most 256 entries, evicted by least
recent use. Oversize outputs bypass admission; cache I/O failures fall back to
rendering. Set `--effect-cache-max-bytes` or `LECLAP_MCP_EFFECT_CACHE_MAX_BYTES`
to a nonnegative safe integer in bytes; `0` disables lookup and publication.
Invalid values use the default. CLI values take precedence over environment values.
Preview results expose `cache: {hits, misses, writes}`; composition results expose
an aggregate `effectCache` when the template contains effects. Individual effect
results also carry `metadata.cache` (`hit`, `miss`, `disabled` or `bypass`).

Each MCP process runs one registered effect worker at a time with at most eight
pending jobs. Queue waiting is bounded by `renderTimeoutMs` and request cancellation;
after admission, worker setup and rendering have a separate `renderTimeoutMs`
deadline. FFmpeg composition retains its existing worker policy. Independent MCP
processes can reuse the disk cache but do not coalesce rendering jobs.
