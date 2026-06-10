//! Cancellation test, isolated in its own file ON PURPOSE: each file under tests/ compiles to its
//! own binary → own process → own ENGINE_LOCK and fftools C globals, and cargo runs test binaries
//! sequentially, so the cancel flags set here can never bleed into another test's run.

use leclap_ffmpeg_core::{cancel, run};

fn s(args: &[&str]) -> Vec<String> {
    args.iter().map(|x| x.to_string()).collect()
}

fn tmp(name: &str) -> String {
    std::env::temp_dir().join(name).to_str().unwrap().to_string()
}

#[test]
fn cancel_aborts_an_inflight_run() {
    let out = tmp("leclap_cli_cancel.mp4");
    let _ = std::fs::remove_file(&out);

    let handle = std::thread::spawn({
        let out = out.clone();
        move || {
            run(s(&[
                "-y", "-f", "lavfi", "-i", "testsrc=duration=120:size=1920x1080:rate=60",
                "-c:v", "mpeg4", "-q:v", "4", &out,
            ]))
        }
    });

    // Wait until ffmpeg is demonstrably past its entry-point flag reset (it has opened the output
    // file) before cancelling, so a slow thread spawn can't let the reset swallow the cancel.
    // Fallback: if the file never appears within ~5s, cancel anyway rather than hang.
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(5);
    while !std::path::Path::new(&out).exists() && std::time::Instant::now() < deadline {
        std::thread::sleep(std::time::Duration::from_millis(50));
    }
    if !std::path::Path::new(&out).exists() {
        std::thread::sleep(std::time::Duration::from_secs(1));
    }
    cancel();
    let result = handle.join().expect("run thread");

    // A run that completed normally exits 0 — non-zero proves the cancel interrupted it.
    assert_ne!(result.code, 0, "cancelled run must not report success");
}
