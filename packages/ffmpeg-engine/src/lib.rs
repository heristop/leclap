//! leclap on-device FFmpeg engine: an embedded FFmpeg command-line executor.
//!
//! FFmpeg's `fftools` (ffmpeg.c / ffprobe.c, patched so `main` → `ffmpeg_main` / `ffprobe_main` and
//! `ffmpeg_main` resets its globals each call) are statically linked into this library alongside the
//! LGPL FFmpeg libs. `run` executes an ffmpeg command (capturing its stderr log); `probe` runs
//! ffprobe (capturing its stdout). Surfaced to Kotlin/Swift via uniffi.

use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_int};
use std::os::unix::io::AsRawFd;
use std::sync::Mutex;

uniffi::setup_scaffolding!();

// fftools keep parsing/transcode state in process globals (ffmpeg.c) and write to the shared
// stdout/stderr fds, so only ONE invocation may run at a time. The core issues commands
// sequentially; this lock makes that explicit (and keeps concurrent callers safe).
static ENGINE_LOCK: Mutex<()> = Mutex::new(());

extern "C" {
    fn leclap_ffmpeg_run(argc: c_int, argv: *const *mut c_char) -> c_int;
    fn leclap_ffprobe_run(argc: c_int, argv: *const *mut c_char) -> c_int;
    fn av_version_info() -> *const c_char;
    fn leclap_ffmpeg_cancel();
}

/// Result of an ffmpeg run: the exit code plus the captured stderr (ffmpeg's log — the reason on
/// failure).
#[derive(uniffi::Record)]
pub struct RunResult {
    pub code: i32,
    pub log: String,
}

/// Result of an ffprobe invocation: the exit code plus its captured stdout (JSON when the caller
/// passes `-print_format json`).
#[derive(uniffi::Record)]
pub struct ProbeResult {
    pub code: i32,
    pub output: String,
}

/// Exit code returned by `run`/`probe` when `args` is malformed — empty, or an arg contains an
/// interior NUL byte. Distinct from any code ffmpeg/ffprobe themselves return (they use 0, 1, 255…),
/// so a caller can tell "I passed bad arguments" apart from "ffmpeg ran and failed".
pub const ARGV_ERROR: i32 = -2;

/// Validate `args` into NUL-terminated `CString`s. `Err` carries a human-readable reason for the
/// `ARGV_ERROR` log: an empty argv, or the index of the arg with an interior NUL byte.
fn build_argv(args: &[String]) -> Result<Vec<CString>, String> {
    if args.is_empty() {
        return Err("no arguments provided".to_string());
    }

    args.iter()
        .enumerate()
        .map(|(i, s)| CString::new(s.as_str()).map_err(|_| format!("argument {i} contains an interior NUL byte")))
        .collect()
}

/// Call the fftools entrypoint with an already-validated argv. The `CString`s own the buffers and
/// must outlive this call; fftools reads argv (getopt-style) but never writes the strings, so the
/// `*mut` cast is for the C signature only.
fn invoke(f: unsafe extern "C" fn(c_int, *const *mut c_char) -> c_int, cstrings: &[CString]) -> i32 {
    let ptrs: Vec<*mut c_char> = cstrings.iter().map(|c| c.as_ptr() as *mut c_char).collect();
    unsafe { f(ptrs.len() as c_int, ptrs.as_ptr()) }
}

/// Restores `target_fd` from a saved duplicate when dropped — including during a panic unwind — so a
/// failure inside the captured body can never leave stdout/stderr pointing at the capture file.
struct FdRestore {
    target_fd: c_int,
    saved: c_int,
}

impl Drop for FdRestore {
    fn drop(&mut self) {
        unsafe {
            libc::fflush(std::ptr::null_mut()); // flush all open C output streams
            libc::dup2(self.saved, self.target_fd);
            libc::close(self.saved);
        }
    }
}

/// Run `body` with the C file descriptor `target_fd` (1=stdout, 2=stderr) redirected to a temp file,
/// then read that file back. fftools write via C stdio, so the guard flushes before restoring.
fn with_captured_fd<F: FnOnce() -> i32>(target_fd: c_int, tmp_name: &str, body: F) -> (i32, String) {
    let tmp = std::env::temp_dir().join(tmp_name);
    let file = match std::fs::File::create(&tmp) {
        Ok(f) => f,
        Err(_) => return (body(), String::new()),
    };

    let saved = unsafe { libc::dup(target_fd) };
    if saved < 0 {
        return (body(), String::new());
    }

    let restore = FdRestore { target_fd, saved };
    unsafe { libc::dup2(file.as_raw_fd(), target_fd) };

    let code = body();
    drop(restore); // flush + restore before reading the capture back

    let captured = std::fs::read_to_string(&tmp).unwrap_or_default();
    let _ = std::fs::remove_file(&tmp);

    (code, captured)
}

/// Run an ffmpeg command. `args` excludes the program name (the shim prepends `ffmpeg`). Output is
/// written to the file(s) named in `args`. Returns the exit code (0 = success) + the stderr log.
#[uniffi::export]
pub fn run(args: Vec<String>) -> RunResult {
    let cstrings = match build_argv(&args) {
        Ok(c) => c,
        Err(reason) => return RunResult { code: ARGV_ERROR, log: format!("argv error: {reason}") },
    };

    let _guard = ENGINE_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let (code, log) = with_captured_fd(2, "leclap-run.log", || invoke(leclap_ffmpeg_run, &cstrings));

    RunResult { code, log }
}

/// Run an ffprobe command, capturing stdout. `args` excludes the program name.
#[uniffi::export]
pub fn probe(args: Vec<String>) -> ProbeResult {
    let cstrings = match build_argv(&args) {
        Ok(c) => c,
        Err(reason) => return ProbeResult { code: ARGV_ERROR, output: format!("argv error: {reason}") },
    };

    let _guard = ENGINE_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let (code, output) = with_captured_fd(1, "leclap-probe.out", || invoke(leclap_ffprobe_run, &cstrings));

    ProbeResult { code, output }
}

/// Request cooperative cancellation of whichever `run` currently holds the engine — with the
/// core's single sequential caller, that is always the intended one. Equivalent to sending ffmpeg
/// one SIGTERM: the transcode loop exits cleanly and `run` returns code 255. A cancel with no run
/// in flight is a no-op (the flags are reset at the start of every run); no effect on `probe`.
/// Deliberately does NOT take ENGINE_LOCK — the running `run` holds it. The cross-thread write to
/// the volatile ints is formally a data race, but mirrors fftools' own signal-handler pattern
/// (aligned int, idempotent write). The hook itself lives in patched ffmpeg.c (patch-fftools.sh
/// step 5) because the flags are static to that translation unit.
#[uniffi::export]
pub fn cancel() {
    unsafe { leclap_ffmpeg_cancel() };
}

/// The FFmpeg build version string the engine links against (e.g. "8.0").
#[uniffi::export]
pub fn version() -> String {
    let ptr = unsafe { av_version_info() };

    if ptr.is_null() {
        return "unknown".to_string();
    }

    unsafe { CStr::from_ptr(ptr) }.to_string_lossy().into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn with_captured_fd_restores_after_a_panicking_body() {
        let _guard = ENGINE_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let tmp = std::env::temp_dir().join("leclap-panic.log");
        let result =
            std::panic::catch_unwind(|| with_captured_fd(2, "leclap-panic.log", || panic!("boom")));
        assert!(result.is_err());
        assert!(std::fs::metadata(&tmp).is_ok(), "capture file should survive the panic");

        // If fd 2 is still redirected, this write lands in the capture file and grows it.
        let before = std::fs::metadata(&tmp).map(|m| m.len()).unwrap_or(0);
        unsafe { libc::write(2, "x".as_ptr().cast(), 1) };
        let after = std::fs::metadata(&tmp).map(|m| m.len()).unwrap_or(0);

        let _ = std::fs::remove_file(&tmp);
        assert_eq!(before, after, "stderr is still redirected to the capture file");
    }

    // M5 argv sentinel: malformed argv short-circuits with ARGV_ERROR (never reaches fftools), so a
    // caller can distinguish bad arguments from an ffmpeg failure. These return before ENGINE_LOCK.
    #[test]
    fn run_rejects_empty_argv_with_sentinel() {
        let r = run(vec![]);
        assert_eq!(r.code, ARGV_ERROR);
        assert!(r.log.contains("argv error"), "log: {}", r.log);
    }

    #[test]
    fn run_rejects_interior_nul_with_sentinel() {
        let r = run(vec!["-i".to_string(), "bad\0name.mp4".to_string()]);
        assert_eq!(r.code, ARGV_ERROR);
        assert!(r.log.contains("NUL"), "log: {}", r.log);
    }

    #[test]
    fn probe_rejects_empty_argv_with_sentinel() {
        let r = probe(vec![]);
        assert_eq!(r.code, ARGV_ERROR);
        assert!(r.output.contains("argv error"), "output: {}", r.output);
    }

    #[test]
    fn probe_rejects_interior_nul_with_sentinel() {
        let r = probe(vec!["-i".to_string(), "bad\0name.mp4".to_string()]);
        assert_eq!(r.code, ARGV_ERROR);
        assert!(r.output.contains("NUL"), "output: {}", r.output);
    }

    // build_argv is the only path where both run and probe can return ARGV_ERROR, so a green
    // success case proves the function doesn't incorrectly reject valid arguments.
    #[test]
    fn build_argv_accepts_typical_args() {
        let args = vec![
            "-y".to_string(),
            "-i".to_string(),
            "input.mp4".to_string(),
            "-f".to_string(),
            "null".to_string(),
            "-".to_string(),
        ];
        let result = build_argv(&args);
        assert!(result.is_ok(), "valid args should not be rejected: {:?}", result);
        let cstrings = result.unwrap();
        assert_eq!(cstrings.len(), args.len());
    }

    #[test]
    fn build_argv_rejects_only_the_offending_arg() {
        // First arg is clean; second has a NUL — the error message names the index.
        let result = build_argv(&["-i".to_string(), "fi\0le.mp4".to_string()]);
        assert!(result.is_err());
        let msg = result.unwrap_err();
        assert!(msg.contains("argument 1"), "expected index in error: {msg}");
    }

    #[test]
    fn argv_error_constant_is_distinct_from_ffmpeg_exit_codes() {
        // ffmpeg exits 0 (success), 1 (generic error), or 255 (cancelled/SIGTERM).
        // ARGV_ERROR must not collide with any of them.
        assert_ne!(ARGV_ERROR, 0);
        assert_ne!(ARGV_ERROR, 1);
        assert_ne!(ARGV_ERROR, 255);
    }
}
