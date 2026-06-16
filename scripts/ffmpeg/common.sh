#!/usr/bin/env bash
# Shared configuration for the FFmpeg cross-builds. Sourced by build-android.sh / build-ios.sh.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/versions.env"

REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WORK_DIR="$REPO_ROOT/scripts/ffmpeg/.work"
SRC_DIR="$WORK_DIR/ffmpeg-$FFMPEG_VERSION"
DIST_DIR="$REPO_ROOT/scripts/ffmpeg/dist"

# Full build for the on-device CLI engine: the `ffmpeg`/`ffprobe` PROGRAMS are built (fftools objects
# are embedded into the engine .so), drawtext is enabled via libfreetype, and the filter/demuxer set
# covers every command the core (SegmentBuilder/FilterManager/MusicComposer/VideoEditor) emits.
# `--disable-ffplay` avoids the SDL dependency (we only need ffmpeg + ffprobe).
FF_COMMON="--enable-static --disable-shared --enable-pic --enable-version3 --disable-gpl \
 --disable-ffplay --disable-doc --disable-autodetect \
 --enable-libfreetype --enable-libharfbuzz --enable-libopenh264 \
 --enable-avformat --enable-avcodec --enable-avfilter --enable-swscale --enable-swresample \
 --enable-protocol=file,pipe \
 --enable-demuxer=mov,matroska,m4a,mp3,aac,wav,concat,lavfi,image2 \
 --enable-muxer=mp4,mov \
 --enable-parser=h264,hevc,aac,mpeg4video,png,mjpeg \
 --enable-decoder=h264,hevc,aac,mp3,pcm_s16le,mpeg4,png,mjpeg \
 --enable-encoder=aac,mpeg4,libopenh264 \
 --enable-filter=scale,crop,pad,setsar,setdar,format,fps,trim,setpts,settb,fade,drawtext,overlay,concat,xfade,loop,tile,\
boxblur,drawbox,gblur,hue,vignette,hflip,vflip,rotate,transpose,negate,colorchannelmixer,colorbalance,curves,zoompan,lutyuv,\
atrim,asetpts,aresample,aformat,amix,afade,acrossfade,afftdn,volume,anull,anullsrc,color,sine \
 --enable-bsf=h264_mp4toannexb,hevc_mp4toannexb,aac_adtstoasc"

# Fetch the FFmpeg source once (shallow), cached under .work/.
fetch_ffmpeg() {
  mkdir -p "$WORK_DIR"
  if [ ! -f "$SRC_DIR/configure" ]; then
    echo "[ffmpeg] cloning $FFMPEG_VERSION ..."
    git clone --depth 1 --branch "$FFMPEG_VERSION" https://github.com/FFmpeg/FFmpeg.git "$SRC_DIR"
  else
    echo "[ffmpeg] source already present at $SRC_DIR"
  fi
}
