#!/usr/bin/env bash
# Render the editor "Preview render" placeholder clips — a branded, obviously-a-draft loop that
# stands in for the user's project_video sections. Run once; the MP4s are committed under
# apps/leclap-web/public/videos/. The clip is an FFmpeg *input* (never browser-played), so MP4 only.
#
#   ./apps/leclap-web/scripts/render-placeholder.sh
set -euo pipefail

app="$(cd "$(dirname "$0")/.." && pwd)"
root="$(cd "$app/../.." && pwd)"
font="$root/packages/leclap-creative-kit/src/library/fonts/Oswald.ttf"
out="$app/public/videos"
dur=30

render() {
  local w="$1" h="$2" small="$3" file="$4"
  # Labels sit as thin watermarks on the top/bottom edges, NOT the centre — the placeholder stands in
  # for a real clip, and the template's own drawtext overlays (titles, captions) land in the middle, so
  # centred placeholder text collides with them. A silent stereo track is muxed in so the multi-segment
  # transition acrossfade always has an audio stream to work with.
  # A whisper of temporal noise dithers the smooth gradient so 8-bit quantization can't band — without
  # it, crf compression bakes in vertical bands that shimmer ("blink glitch noise") once the preview
  # pipeline re-encodes the clip through its fades. Kept subtle (alls=2, no -tune grain) so the clip
  # stays a few MB — it is fetched into the WASM in-memory FS on every preview render.
  ffmpeg -y -hide_banner -loglevel error \
    -f lavfi -i "gradients=s=${w}x${h}:c0=0x7C83FD:c1=0xFF8AAE:d=${dur}:speed=0.015" \
    -f lavfi -i "anullsrc=channel_layout=stereo:sample_rate=44100" \
    -filter_complex "[0:v]noise=alls=2:allf=t,drawtext=fontfile='${font}':text='PREVIEW':fontcolor=white@0.8:fontsize=${small}:x=(w-text_w)/2:y=28,\
drawtext=fontfile='${font}':text='sample footage':fontcolor=white@0.75:fontsize=${small}:x=(w-text_w)/2:y=h-th-28[v]" \
    -map "[v]" -map 1:a \
    -t "$dur" -r 30 -c:v libx264 -profile:v high -preset slow -crf 21 -pix_fmt yuv420p \
    -c:a aac -ac 2 -shortest -movflags +faststart "$out/$file"
  echo "rendered $out/$file"
}

render 1280 720 40 placeholder-landscape.mp4
render 720 1280 44 placeholder-portrait.mp4
