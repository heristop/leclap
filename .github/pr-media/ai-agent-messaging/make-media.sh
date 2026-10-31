#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../.."
# Serve the merge base on 5411 and this branch on 5412, with assets staged in both.
node .github/pr-media/ai-agent-messaging/capture.mjs
pnpm --filter ffmpeg-video-composer build
pnpm --filter @leclap/cli build
python3 examples/agentic-pr-video/evidence-skill/build.py \
  --content .github/pr-media/ai-agent-messaging/content.json \
  --work build/pr/ai-messaging \
  --leclap "node $PWD/packages/leclap-cli/dist/index.js"
