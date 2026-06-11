# @leclap/mcp

> **WIP** — scaffold only. The tool surface is implemented in follow-up tasks.

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes the
deterministic [`ffmpeg-video-composer`](../ffmpeg-video-composer) engine as
agent-callable video composition tools over stdio.

The agent authors a template descriptor (JSON) and picks media; the server validates that
JSON against the core's zod schema and renders it. **No LLM runs inside the server** —
rendering is deterministic. See the design spec:
[`docs/superpowers/specs/2026-06-11-leclap-mcp-design.md`](../../docs/superpowers/specs/2026-06-11-leclap-mcp-design.md).

## Planned tools

- `list_templates` — list the bundled templates.
- `get_template` — return one bundled template descriptor by id.
- `get_template_schema` — return the JSON Schema for a template descriptor.
- `compose_video` — validate + render a descriptor, returning the output path.
- `probe_media` — probe a media file (duration / resolution / codec).

## Build

```bash
pnpm --filter @leclap/mcp build
```

Emits `dist/index.js` (the `leclap-mcp` stdio server bin) and `dist/render-worker.js`
(the forked worker that runs `compile()` off the JSON-RPC channel).
