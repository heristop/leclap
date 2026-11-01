# Showcase mobile glow evidence

Before: merge base `a5840d266263a361906a94e97348503c6777883c`, built in a separate worktree. After: this branch. Both use the same staged public assets.

Spanish showcase, JavaScript enabled, normal motion. Stills: 390×844 and 1440×900 at 2×, light and dark. The video deliberately uses a portrait 390×844 capture, letterboxed by the repository template, to show the mobile defect. The bottom QA overlay reports viewport width and maximum document width; it is capture instrumentation, not product UI. Both glows start at the same animation phase and continue running.

```sh
BEFORE_URL=http://localhost:5414 AFTER_URL=http://localhost:5413 \
  node .github/pr-media/showcase-mobile-glow/record.mjs /tmp/leclap-glow-evidence
python3 examples/agentic-pr-video/evidence-skill/build.py \
  --content /tmp/leclap-glow-evidence/content.json \
  --work /tmp/leclap-glow-evidence \
  --leclap 'node packages/leclap-cli/dist/index.js'
```

Set `E2E_CHROMIUM_PATH` if using an existing Chromium installation. `VIDEO_ONLY=1` skips still capture. Convert PNG stills to WebP with FFmpeg at quality 82. Copy the final MP4 and resolved content JSON here; raw captures stay outside git. Rendered with the repository-owned house template and FFmpeg 8.1.1.
