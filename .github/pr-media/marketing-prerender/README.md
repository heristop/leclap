# Marketing prerender evidence

French About page at `/fr/about`, with JavaScript disabled. The blank before state is the actual empty app root, not a loading screen. Static HTML uses the default light theme; theme switching requires JavaScript.

Before: `aaf5d05321e00adc94fb459603608113f9d90e4c` (branch merge base). After: this branch's marketing prerender implementation. Stills: 1440×900 and 390×844 at 2×. Recording: 1024×768.

Build both worktrees and serve their `apps/leclap-web/dist` with Wrangler Pages. Then run:

```sh
BEFORE_URL=http://localhost:5414 AFTER_URL=http://localhost:5413 \
  node .github/pr-media/marketing-prerender/record.mjs /tmp/leclap-marketing-evidence
python3 examples/agentic-pr-video/evidence-skill/build.py \
  --content /tmp/leclap-marketing-evidence/content.json \
  --work /tmp/leclap-marketing-evidence \
  --leclap 'node packages/leclap-cli/dist/index.js'
```

Optionally set `E2E_CHROMIUM_PATH` to an installed Chromium executable. Convert the four PNG stills with `ffmpeg -i input.png -c:v libwebp -quality 82 output.webp`. Copy the rendered MP4 and resolved content JSON here. Raw recordings and intermediate render files stay outside the repository.

Rendered with the repository-owned evidence workflow and FFmpeg 8.1.1. Video QC passed; the predominantly silent soundtrack is intentional.
