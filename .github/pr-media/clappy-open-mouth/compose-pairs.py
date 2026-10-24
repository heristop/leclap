"""Usage: python3 compose-pairs.py <raw-dir> <out-dir>
Joins capture.mjs's before/after stills side by side into still WebPs (needs an ffmpeg with libwebp)."""
import os
import subprocess
import sys

raw, out_dir = sys.argv[1:3]
os.makedirs(out_dir, exist_ok=True)
for scheme in ('light', 'dark'):
    for vp in ('1440', '390'):
        for kind in ('page', 'mouth'):
            graph = '[0]scale=iw*0.75:-1[a];[1]scale=iw*0.75:-1[b];[a][b]hstack' if kind == 'page' else '[0][1]hstack'
            subprocess.run(
                ['ffmpeg', '-v', 'error', '-y', '-i', f'{raw}/before-{scheme}-{vp}-{kind}.png', '-i',
                 f'{raw}/after-{scheme}-{vp}-{kind}.png', '-filter_complex', graph, '-c:v', 'libwebp', '-quality', '82',
                 f'{out_dir}/{kind}-{scheme}-{vp}.webp'],
                check=True,
            )
