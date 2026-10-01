# JSON title effects through LeClap

This reference project keeps creative controls in LeClap JSON. A trusted Remotion component renders the title effect; LeClap then composes it with the ordinary outro section and exports the video.

## Prepare

From the repository root, build the core and MCP packages. Install the example's pinned React/Remotion dependencies separately:

```sh
pnpm --filter ffmpeg-video-composer build
pnpm --filter @leclap/mcp build
pnpm --dir examples/llm-remotion-title install --ignore-workspace
node examples/llm-remotion-title/generate-media.mjs /absolute/path/to/font.ttf
```

The fixture generator needs system FFmpeg and a local TTF font you are entitled to use. It creates a ten-second background, logo and font copy under ignored `media/`; replace these with your own media while retaining duration and slot names.

Configure the MCP server with absolute paths:

```text
LECLAP_MCP_ALLOW_REMOTION=1
LECLAP_MCP_REMOTION_ENTRY=/absolute/path/examples/llm-remotion-title/remotion/index.ts
LECLAP_MCP_MEDIA_DIR=/absolute/path/examples/llm-remotion-title
LECLAP_MCP_OUTPUT_DIR=/absolute/path/examples/llm-remotion-title/build
```

If using an installed compatible Chrome instead of downloading Chromium, set `LECLAP_MCP_REMOTION_BROWSER` to its executable path.

## Agent workflow

1. Read `get_template_schema` and `get_effect_schema` for the registered `leclap.title-reveal@1.0.0` effect.
2. Submit `template.json` (its relative assets resolve under the configured media directory) to `validate_template`; keep the returned revision.
3. Use `render_preview` with `section: "intro"` and either `frames: [0, 15, 30, 150, 299]` or `frameRange: { "from": 0, "to": 89 }` (inclusive). Pass the expected revision to reject stale requests.
4. Call `patch_template` with the JSON, expected revision and a batch of semantic prop edits.
5. Inspect the new preview, then pass the revised JSON to `compose_video`. Use `get_effect_schema` without arguments for the title catalog, or pass its exact `id` and `version`.

Example edit request:

```json
{
  "template": "replace this string with the actual template object",
  "expectedRevision": "revision returned by validate_template",
  "edits": [
    {
      "section": "intro",
      "props": {
        "headlineY": 260,
        "logoDelayFrames": 27,
        "springDamping": 25
      }
    }
  ]
}
```

The illustrative `template` and `expectedRevision` values above must be replaced before making a tool call. Patches return a new JSON document; save it for subsequent calls. No server-side saved-project store is implied.

## Boundaries

The first registry accepts the fixed title ID/version and typed controls. Source remains in `remotion/` and is editable with normal code tools. Keep its exact source/dependency versions alongside the JSON to recreate the effect. Changing source changes the implementation identity recorded for the render.

Opaque H.264 output is supported first. Transparent effects, an arbitrary effect registry, persistent scene caching, full mobile graphics generation and a visual editor belong to later roadmap deliveries. Font width and visual pacing still need inspection of actual preview artifacts.

## Initial measured baseline

Local verification on an Apple M2 Pro (12 CPU cores, 32 GB RAM), Node 24.19.0, Remotion 4.0.509, Chrome 131.0.6778.70 and system FFmpeg 8.1.1 used the generated color/logo fixtures and a local Arial TTF. Rendering used one Remotion worker at 1280×720, 30 fps, H.264. These are single-run observations, not performance budgets; OS caches were not cleared.

| Operation                                            | Wall time | Returned media bytes |
| ---------------------------------------------------- | --------: | -------------------: |
| Five PNG frames (0, 15, 30, 150, 299), first request |    4.60 s |              111,627 |
| Same five frames, repeated request                   |    3.65 s |              111,627 |
| Inclusive range 0..29                                |    3.98 s |               66,057 |
| Registered Remotion title alone, 300 frames          |   26.12 s |              502,263 |
| Mixed LeClap project, title plus two-second outro    |   35.35 s |              355,837 |

All previews, the standalone title and the mixed composition reported the same implementation/input provenance hash; repeated PNG bytes also matched. `ffprobe` measured 10.000 seconds of video for the title, 1.000 for the range, and 11.933333 for the mixed project. Container durations include AAC padding (10.048, 1.045333 and 11.954362 seconds respectively); the mixed route retains the existing engine's frame trimming. The standalone route encodes the title once; mixed composition additionally normalizes its sections through FFmpeg. Persistent effect caching remains future work.

The whole verification command reported a maximum resident set of about 566 MiB. This is the command's resource report, not a sampled sum of simultaneously running Chromium/FFmpeg processes. Transient job directories were checked after rendering: preview files/provenance remained, while staged media, bundles and consumed composition clips were removed.

## Persistent effect reuse

Registered previews and full title clips now reuse a bounded disk cache. By default it retains up to 512 MiB and 256 entries under the MCP media directory. Set `LECLAP_MCP_EFFECT_CACHE_MAX_BYTES=0` to disable it, or choose another integer byte budget. Preview replies include `cache`; composition replies include `effectCache`, each with `hits`, `misses` and `writes`.

Cache lookup follows fresh asset/source bundling and browser identification. This preserves invalidation for imported code and exact asset contents; it still pays preparation costs. The final FFmpeg assembly runs on each composition. One registered effect worker runs per MCP process, with at most eight queued jobs.

A subsequent local check on the same M2 Pro/runtime used a separate copy of the reference scene, `CACHE WITH LECLAP`, a 2 MiB cache budget and unchanged frame/output settings. OS caches were not cleared; these are single-run observations:

| Operation                        | Cache miss | Cache hit |
| -------------------------------- | ---------: | --------: |
| Five preview frames              |     8.24 s |    1.53 s |
| Same frames after restarting MCP |          — |    1.50 s |
| Inclusive range 0..29            |     4.61 s |    2.01 s |
| Title plus two-second outro      |    27.07 s |    2.70 s |

Repeated PNGs, range clips and composed MP4s matched by SHA256 in this fixture. Headline-position changes, imported palette-code edits and a logo-file replacement each produced a miss and new provenance. Disabling caching produced no hits or writes without changing implementation identity. The measured cache held nine entries totaling 746,360 artifact/manifest bytes before the additional asset-edit check. Corrupt entries, lower budgets, metadata mismatches, eviction, cancellation and non-regular files are covered by unit regressions.

The whole verification command reported about 950 MiB maximum resident set; this is not a sampled total across concurrent subprocesses. Cached composition avoids the effect encode while retaining the existing FFmpeg assembly work. Persistent bundle caching and whole-project incremental compilation remain separate future deliveries.
