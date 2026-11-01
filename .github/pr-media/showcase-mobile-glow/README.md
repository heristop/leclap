# Showcase mobile glow evidence

Before: merge base `a5840d266263a361906a94e97348503c6777883c`, built in a separate worktree. After: this branch. Both use the same staged public assets.

Spanish showcase, JavaScript enabled, normal motion. Stills: 390×844 and 1440×900 at 2×, light and dark. The replacement video crops the player from real 390×844 mobile captures and enlarges the crop to fill each 4:3 pane. The QA overlay reports viewport width, document width and horizontal movement; it is capture instrumentation, not product UI. Both glows start at the same animation phase and continue running. Both pages receive identical horizontal scroll attempts. Before/after proof stills show the result after the first attempt.

```sh
BEFORE_URL=http://localhost:5414 AFTER_URL=http://localhost:5413 \
  node .github/pr-media/showcase-mobile-glow/record-closeup.mjs /tmp/leclap-glow-closeup
python3 examples/agentic-pr-video/evidence-skill/build.py \
  --content /tmp/leclap-glow-closeup/content.json \
  --work /tmp/leclap-glow-closeup \
  --leclap 'node packages/leclap-cli/dist/index.js'
```

Set `E2E_CHROMIUM_PATH` if using an existing Chromium installation. The original `record.mjs` records the full-page light/dark snapshots. `record-closeup.mjs` produces the clearer comparison video and annotated close-up stills. Convert PNG stills to WebP with FFmpeg at quality 82. Copy the final MP4 and resolved content JSON here; raw captures stay outside git. Rendered with the repository-owned house template and FFmpeg 8.1.1.
