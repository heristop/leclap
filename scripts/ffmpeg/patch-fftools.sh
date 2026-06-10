#!/usr/bin/env bash
# Patch the FFmpeg fftools sources so the CLI can be EMBEDDED into a library and called repeatedly:
#  1. rename `main` → `ffmpeg_main` / `ffprobe_main` (+ forward prototypes, since FFmpeg builds with
#     -Werror=missing-prototypes, which `main` is exempt from but our renamed functions are not);
#  2. reset ffmpeg.c's global counters/flags at the top of ffmpeg_main so it is re-entrant
#     (ffmpeg_cleanup frees the arrays but does NOT zero nb_input_files/… — a 2nd call would crash);
#  3. rename ffprobe.c's `program_name`/`program_birth_year`/`show_help_default` (which ffmpeg.c also
#     defines) via macros, so archiving both into one engine lib has no duplicate symbols on either
#     GNU lld (Android) or ld64 (macOS). These only affect ffprobe's banner/-h text, not its output.
# Each step is independently idempotent. Invoked by the build scripts before configure.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"
FT="$SRC_DIR/fftools"

# 1a. rename entrypoints
grep -q 'int ffmpeg_main('  "$FT/ffmpeg.c"  || perl -0pi -e 's/\bint main\(int argc, char \*\*argv\)/int ffmpeg_main(int argc, char **argv)/'  "$FT/ffmpeg.c"
grep -q 'int ffprobe_main(' "$FT/ffprobe.c" || perl -0pi -e 's/\bint main\(int argc, char \*\*argv\)/int ffprobe_main(int argc, char **argv)/' "$FT/ffprobe.c"

# 1b. forward prototypes (satisfy -Wmissing-prototypes)
grep -q 'int ffmpeg_main(int argc, char \*\*argv);'  "$FT/ffmpeg.c"  || perl -0pi -e 's/(int ffmpeg_main\(int argc, char \*\*argv\)\n\{)/int ffmpeg_main(int argc, char **argv);\n$1/'  "$FT/ffmpeg.c"
grep -q 'int ffprobe_main(int argc, char \*\*argv);' "$FT/ffprobe.c" || perl -0pi -e 's/(int ffprobe_main\(int argc, char \*\*argv\)\n\{)/int ffprobe_main(int argc, char **argv);\n$1/' "$FT/ffprobe.c"

# 2. re-entrancy reset at the top of ffmpeg_main
grep -q 'leclap-reentrancy' "$FT/ffmpeg.c" || perl -0pi -e 's/(\n)(    init_dynload\(\);)/$1    \/* leclap-reentrancy: reset fftools globals so ffmpeg_main works across calls *\/\n    nb_input_files = 0; nb_output_files = 0; nb_filtergraphs = 0; nb_decoders = 0;\n    input_files = NULL; output_files = NULL; filtergraphs = NULL; decoders = NULL;\n    atomic_store(&nb_output_dumped, 0);\n    received_sigterm = 0; received_nb_signals = 0;\n    atomic_store(&transcode_init_done, 0); ffmpeg_exited = 0;\n$2/' "$FT/ffmpeg.c"

# 3. rename ffprobe's globals that collide with ffmpeg.c (prepend macros before any include)
grep -q 'leclap-noclash' "$FT/ffprobe.c" || perl -0pi -e 's/\A/\/* leclap-noclash: avoid duplicate symbols with ffmpeg.c *\/\n#define program_name ffprobe_program_name\n#define program_birth_year ffprobe_program_birth_year\n#define show_help_default ffprobe_show_help_default\n/' "$FT/ffprobe.c"

# 4. libavfilter drawtext UTF-8 fix: measure_text() counts CHARACTERS in `num_chars` but hands it to
#    shape_text_hb() → hb_buffer_add_utf8(buf, text, length, ...), whose `length` is a BYTE count. For
#    ASCII chars==bytes, but a line ending in a multi-byte char (e.g. the typographic close-quote ”,
#    U+201D = 3 bytes) is passed a byte length short by the multi-byte slack, so harfbuzz shapes a
#    truncated prefix and the trailing glyph(s) silently vanish (`“alexandre”` → `“alexandr`). Count
#    bytes instead: stamp each char's start and advance num_chars by the bytes GET_UTF8 consumed (the
#    `-1` reset stays correct — ff_is_newline only matches single-byte \n\r\f\v).
DT="$SRC_DIR/libavfilter/vf_drawtext.c"
grep -q 'leclap-drawtext-utf8' "$DT" || perl -0pi -e '
  s/(\n    char\* p;\n)/$1    char *char_start = NULL; \/* leclap-drawtext-utf8 *\/\n/;
  s/(for \(i = 0, p = textdup; 1; i\+\+\) \{\n)/${1}        char_start = p;\n/;
  s/\n        \+\+num_chars;\n/\n        num_chars += p - char_start;\n/;
' "$DT"

# 5. cancel hook: ffmpeg.c's shutdown flags are static (n8.0), so expose a same-TU setter the
#    engine can call to request cooperative cancellation (mimics ONE SIGTERM: the transcode loop
#    notices, shuts down cleanly, and ffmpeg_main returns 255). Prototype satisfies
#    -Wmissing-prototypes. Injected before ffmpeg_main's forward prototype (step 1b), which sits
#    after the static flag declarations.
grep -q 'static volatile int received_sigterm' "$FT/ffmpeg.c" || { echo "[patch-fftools] cancel flags changed upstream"; exit 1; }
grep -q 'leclap-cancel' "$FT/ffmpeg.c" || perl -0pi -e 's/(int ffmpeg_main\(int argc, char \*\*argv\);\n)/\/* leclap-cancel: cooperative cancel — set the static shutdown flags from outside this TU *\/\nvoid leclap_ffmpeg_cancel(void);\nvoid leclap_ffmpeg_cancel(void) { received_sigterm = SIGTERM; received_nb_signals = 1; }\n$1/' "$FT/ffmpeg.c"

# verify
grep -q 'int ffmpeg_main(int argc, char \*\*argv);'  "$FT/ffmpeg.c"  || { echo "[patch-fftools] ffmpeg.c FAILED";  exit 1; }
grep -q 'leclap-reentrancy' "$FT/ffmpeg.c"  || { echo "[patch-fftools] reset FAILED";   exit 1; }
grep -q 'leclap-noclash'    "$FT/ffprobe.c" || { echo "[patch-fftools] ffprobe FAILED";  exit 1; }
grep -q 'leclap-drawtext-utf8' "$DT"        || { echo "[patch-fftools] drawtext FAILED"; exit 1; }
grep -q 'leclap-cancel'     "$FT/ffmpeg.c"  || { echo "[patch-fftools] cancel FAILED";   exit 1; }
echo "[patch-fftools] patched ffmpeg.c + ffprobe.c + vf_drawtext.c"
