# Agent demo — compose a premium video from a prompt

A minimal, reproducible proof of the **agent → deterministic video** loop: an AI agent discovers a
template, validates it, and renders it to an mp4 **on the machine** — no upload, no server, no
generative model. The same template renders identically on a phone (React Native) and in the
browser (WASM); here it runs headless on Node via the [`@leclap/mcp`](../../packages/mcp) server.

## Run it headless (no SDK, no API key)

[`run.mjs`](./run.mjs) speaks the MCP stdio protocol directly (newline-delimited JSON-RPC), so it
needs only `node` and a `drawtext`-capable FFmpeg on your `PATH`. Build the engine + server once,
then run:

```bash
pnpm --filter ffmpeg-video-composer build
pnpm --filter @leclap/mcp build
node examples/agent-demo/run.mjs              # composes the premium_quote card (no clips needed)
node examples/agent-demo/run.mjs premium_titles
```

It prints the validate result and the rendered mp4 path (under `examples/agent-demo/out/`):

```
▸ Asking the engine to validate "premium_quote" (instant, no render)…
   {"valid":true,"sectionCount":1,"orientation":"landscape","requiredClips":[],"formFields":[]}
▸ Composing "premium_quote" → deterministic mp4 (on your machine, no upload)…
✔ Done.
  output : …/examples/agent-demo/out/<renderId>/output.mp4
  format : h264/aac, 5s, 180926 bytes
```

The premium templates use the bundled fonts (BebasNeue, Oswald, Playfair Display, Pacifico…) and
only on-device-safe filters, so the output looks professional with zero assets and is byte-for-byte
reproducible.

## Use it from an AI agent (Claude Desktop / Cursor)

Point your MCP client at the built server. For Claude Desktop, in
`~/Library/Application Support/Claude/claude_desktop_config.json` (absolute paths only):

```json
{
  "mcpServers": {
    "leclap": {
      "command": "node",
      "args": ["/abs/path/to/ffmpeg-video-composer/packages/mcp/dist/index.js"],
      "env": {
        "LECLAP_MCP_OUTPUT_DIR": "/abs/path/to/Movies/leclap-renders",
        "LECLAP_MCP_MEDIA_DIR": "/abs/path/to/Movies"
      }
    }
  }
}
```

Then try the `/compose-video` prompt, or just ask:

> "List the video templates, then make a premium title card for **Emily Parker, Frontend
> Developer** and render it."

> "Compose a 15s premium quote card with the line _'Design is how it works'_ and open the result."

The agent calls `get_template` → edits the descriptor → `validate_template` (instant) →
`compose_video`, and hands you back the mp4 path. See the
[`@leclap/mcp` README](../../packages/mcp/README.md) for the full tool/prompt reference.
