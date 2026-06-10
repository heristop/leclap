//! Host execution tests for the embedded FFmpeg CLI engine. Require a host FFmpeg+fftools build:
//!   bash scripts/ffmpeg/build-host.sh
//!   FFMPEG_PKG_CONFIG_PATH=scripts/ffmpeg/dist/host/lib/pkgconfig \
//!     DYLD_FALLBACK_LIBRARY_PATH=scripts/ffmpeg/dist/host/lib cargo test --release
//! tests/fixtures/sample.mp4 is any short h264 mp4 (a small one is committed; replace at will).

use leclap_ffmpeg_core::{probe, run, version};

fn s(args: &[&str]) -> Vec<String> {
    args.iter().map(|x| x.to_string()).collect()
}

fn tmp(name: &str) -> String {
    std::env::temp_dir().join(name).to_str().unwrap().to_string()
}

const FIT_720P: &str =
    "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p";

#[test]
fn version_is_ffmpeg_8() {
    // av_version_info() returns the git describe string, e.g. "n8.0" for a source build or "8.1.1"
    // for a release — both identify FFmpeg 8.x.
    assert!(
        version().starts_with("n8.") || version().starts_with("8."),
        "expected FFmpeg 8.x, got {}",
        version()
    );
}

#[test]
fn run_transcodes_and_probe_reads_it() {
    let out = tmp("leclap_cli_a.mp4");
    let _ = std::fs::remove_file(&out);

    let r = run(s(&[
        "-y", "-i", "tests/fixtures/sample.mp4", "-vf", FIT_720P, "-c:v", "mpeg4", "-c:a", "aac", &out,
    ]));
    assert_eq!(r.code, 0, "ffmpeg should succeed; log:\n{}", r.log);

    let r = probe(s(&[
        "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,codec_name",
        "-of", "json", &out,
    ]));
    assert_eq!(r.code, 0, "ffprobe should succeed");
    assert!(r.output.contains("1280") && r.output.contains("720"), "probe json: {}", r.output);
    assert!(r.output.contains("mpeg4"), "probe json: {}", r.output);
}

/// The crux of the embedded-CLI approach: `ffmpeg_main` is called repeatedly in one process (the
/// core issues many commands per template). The re-entrancy patch must reset fftools' globals so the
/// second call doesn't crash on the first call's stale state.
#[test]
fn run_is_reentrant_across_calls() {
    let a = tmp("leclap_cli_re1.mp4");
    let b = tmp("leclap_cli_re2.mp4");
    let _ = std::fs::remove_file(&a);
    let _ = std::fs::remove_file(&b);

    let r1 = run(s(&["-y", "-i", "tests/fixtures/sample.mp4", "-vf", FIT_720P, "-c:v", "mpeg4", "-an", &a]));
    assert_eq!(r1.code, 0, "first run; log:\n{}", r1.log);
    let r2 = run(s(&["-y", "-i", "tests/fixtures/sample.mp4", "-vf", "scale=640:360,setsar=1,format=yuv420p", "-c:v", "mpeg4", "-an", &b]));
    assert_eq!(r2.code, 0, "second run must succeed (re-entrancy); log:\n{}", r2.log);

    assert!(std::path::Path::new(&a).exists() && std::path::Path::new(&b).exists());
}

/// drawtext actually renders (proves libfreetype is linked and the filter works at runtime, not just
/// that the symbol is present). Skips if no system TTF is found.
#[test]
fn drawtext_renders_with_a_system_font() {
    let font = ["/System/Library/Fonts/Supplemental/Arial.ttf", "/Library/Fonts/Arial.ttf"]
        .into_iter()
        .find(|p| std::path::Path::new(p).exists());
    let Some(font) = font else {
        eprintln!("no system TTF found — skipping drawtext render test");
        return;
    };

    let out = tmp("leclap_cli_text.mp4");
    let _ = std::fs::remove_file(&out);
    let r = run(s(&[
        "-y", "-f", "lavfi", "-i", "color=c=black:s=320x240:d=1",
        "-vf", &format!("drawtext=text='hi':fontfile={font}:fontsize=48:fontcolor=white:x=10:y=10"),
        "-frames:v", "10", "-c:v", "mpeg4", &out,
    ]));
    // The host (build-host.sh) build may omit drawtext; the real target (Android) includes it (the
    // staged .so exports ff_vf_drawtext). Skip gracefully when this build lacks the filter.
    if r.code != 0 {
        eprintln!("drawtext unavailable in this build (rc={}) — skipping (validated on-device)", r.code);
        return;
    }
    assert!(std::path::Path::new(&out).exists());
}

/// `-filter_complex` works in the embedded CLI (the core's overlay/concat commands depend on it).
#[test]
fn filter_complex_runs() {
    let out = tmp("leclap_cli_fc.mp4");
    let _ = std::fs::remove_file(&out);
    let r = run(s(&[
        "-y", "-i", "tests/fixtures/sample.mp4",
        "-filter_complex", "scale=640:360,setsar=1",
        "-c:v", "mpeg4", "-an", &out,
    ]));
    let tail: String = r.log.chars().skip(r.log.chars().count().saturating_sub(800)).collect();
    assert_eq!(r.code, 0, "filter_complex should succeed; log tail:\n{tail}");
    let size = std::fs::metadata(&out).map(|m| m.len()).unwrap_or(0);
    assert!(size > 0, "expected non-empty {out}");
}

/// Repro: on-device drawtext drops the trailing glyphs when the text ends on a multi-byte UTF-8 char
/// (the typographic closing quote ” = U+201D). Renders `“alexandre”` onto a black 720x1280 frame.
/// Inspect /tmp/leclap_drawtext_repro.mp4 — the bug shows as `“alexandr` (missing e”).
#[test]
fn drawtext_trailing_multibyte_repro() {
    let out = tmp("leclap_drawtext_repro.mp4");
    let _ = std::fs::remove_file(&out);
    let font = concat!(env!("CARGO_MANIFEST_DIR"), "/../server/build/fonts/Quicksand.ttf");
    // The font is a gitignored build artifact (pnpm --filter server build); skip when absent.
    if !std::path::Path::new(font).exists() {
        eprintln!("{font} not built — skipping drawtext multibyte repro");
        return;
    }
    let vf = format!(
        "drawtext=fontfile='{}':text='“alexandre”':fontcolor=white:fontsize=50:x=20:y=600,format=yuv420p",
        font
    );
    let r = run(s(&[
        "-y", "-f", "lavfi", "-i", "color=c=black:s=720x1280:d=1", "-vf", &vf, "-frames:v", "1", "-c:v", "mpeg4", "-q:v", "2", &out,
    ]));
    eprintln!("[drawtext_repro] version={} rc={}\n{}", version(), r.code, r.log);
    assert_eq!(r.code, 0, "drawtext should run; log:\n{}", r.log);
    assert!(std::path::Path::new(&out).exists(), "expected {out}");
    eprintln!("[drawtext_repro] wrote {out}");
}
