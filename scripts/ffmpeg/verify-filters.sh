#!/usr/bin/env bash
# Verifies every filter in common.sh's --enable-filter list was actually enabled by the last
# FFmpeg configure run (config_components.h) — --disable-gpl silently drops GPL-dep filters.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

CONFIG="$SRC_DIR/config_components.h"
[ -f "$CONFIG" ] || { echo "config_components.h missing — run a build first"; exit 1; }

# FF_COMMON is already continuation-joined by bash (it sourced common.sh's own line-continued
# assignment), so a single grep for the --enable-filter= token — stopping at the next space —
# reproduces the same value the TS parser (capability-sources.ts) derives from the raw source text.
LIST=$(echo "$FF_COMMON" | grep -o -- '--enable-filter=[^ ]*' | sed 's/--enable-filter=//')
FILTERS=$(echo "$LIST" | tr ',' '\n' | sed '/^$/d')

MISSING=0
for f in $FILTERS; do
  UPPER=$(echo "$f" | tr '[:lower:]' '[:upper:]')
  grep -q "#define CONFIG_${UPPER}_FILTER 1" "$CONFIG" || { echo "MISSING on this build: $f"; MISSING=1; }
done

COUNT=$(echo "$FILTERS" | wc -l | tr -d ' ')
[ "$MISSING" = 0 ] && echo "all $COUNT listed filters enabled"
exit $MISSING
