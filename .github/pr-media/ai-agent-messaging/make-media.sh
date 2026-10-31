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
python3 - <<'PY'
from pathlib import Path
import shutil
import subprocess
work = Path('build/pr/ai-messaging')
out = Path('.github/pr-media/ai-agent-messaging')
for width in [1440, 390]:
    for theme in ['light', 'dark']:
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(work / f'before-{width}-{theme}.png'), '-i', str(work / f'after-{width}-{theme}.png'), '-filter_complex', '[0:v]scale=720:-2[a];[1:v]scale=720:-2[b];[a][b]hstack', '-c:v', 'libwebp', '-quality', '82', str(out / f'home-{width}-{theme}.webp')], check=True)
for name in ['guide-1440-light', 'guide-390-dark', 'workflow-1440-light', 'features-1440-dark']:
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(work / f'{name}.png'), '-vf', 'scale=1280:-2', '-c:v', 'libwebp', '-quality', '82', str(out / f'{name}.webp')], check=True)
for extension in ['mp4', 'webp']:
    name = f'leclap-pr-151-evidence.{extension}'
    shutil.copy2(work / name, out / name)
PY
