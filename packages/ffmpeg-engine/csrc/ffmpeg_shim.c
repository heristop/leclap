/*
 * Bridges Rust → the embedded FFmpeg command-line tools (fftools). `build-android.sh` patches
 * fftools so `main` becomes `ffmpeg_main` / `ffprobe_main` (and ffmpeg.c resets its globals on each
 * call, making it re-entrant). These wrappers prepend the conventional argv[0] program name and
 * forward to the renamed entrypoints, returning the process-style exit code.
 *
 * The core (FFmpegLeclapAdapter) hands us the command WITHOUT a program name, e.g.
 *   ["-y", "-i", "in.mp4", "-vf", "scale=1280:720", "out.mp4"]
 * so we synthesize argv[0].
 */
#include <stdlib.h>

extern int ffmpeg_main(int argc, char **argv);
extern int ffprobe_main(int argc, char **argv);

static int run_tool(int (*entry)(int, char **), const char *prog, int argc, char *const *argv) {
    /* fftools expects a mutable argv[0..argc] with a trailing NULL. */
    char **a = (char **)malloc(sizeof(char *) * (size_t)(argc + 2));
    if (!a) {
        return -1;
    }
    a[0] = (char *)prog;
    for (int i = 0; i < argc; i++) {
        a[i + 1] = argv[i];
    }
    a[argc + 1] = NULL;
    int rc = entry(argc + 1, a);
    free(a);
    return rc;
}

int leclap_ffmpeg_run(int argc, char *const *argv) {
    return run_tool(ffmpeg_main, "ffmpeg", argc, argv);
}

int leclap_ffprobe_run(int argc, char *const *argv) {
    return run_tool(ffprobe_main, "ffprobe", argc, argv);
}
