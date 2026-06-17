use std::path::PathBuf;

// Links the engine cdylib against the embedded FFmpeg CLI:
//   leclap_shim (C)  →  libfftools.a (ffmpeg_main/ffprobe_main)  →  static FFmpeg libs  →  freetype + system
// All are STATIC, producing a self-contained .so (no FFmpeg .so deps to resolve at runtime — this is
// what made JNA's dlopen namespace work in P1). FFMPEG_PKG_CONFIG_PATH points at the per-target dist
// (set by build-android-jni.sh per ABI, or a host static build for `cargo test`).
fn main() {
    println!("cargo:rerun-if-changed=csrc/ffmpeg_shim.c");
    println!("cargo:rerun-if-env-changed=FFMPEG_PKG_CONFIG_PATH");

    // The `uniffi-bindgen` helper bin builds without linking FFmpeg; skip the native link when the
    // dist isn't provided (a real lib build always sets this, via build-android-jni.sh).
    let Ok(pc) = std::env::var("FFMPEG_PKG_CONFIG_PATH") else {
        println!("cargo:warning=FFMPEG_PKG_CONFIG_PATH unset — skipping FFmpeg link (bindgen-only build)");
        return;
    };

    // 1. The C shim that prepends argv[0] and calls the renamed entrypoints.
    cc::Build::new().file("csrc/ffmpeg_shim.c").compile("leclap_shim");
    let dist_lib = PathBuf::from(&pc)
        .parent()
        .expect("pkgconfig dir has a parent")
        .to_path_buf();

    // patch-fftools.sh renames ffprobe's 3 globals that also live in ffmpeg.c, so there are no
    // duplicate symbols. Older Android `libfftools.a` (built before that fix) may still clash; GNU
    // lld accepts --allow-multiple-definition as a harmless belt-and-suspenders. ld64 (macOS)
    // rejects the flag and relies on the source fix.
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("android") {
        println!("cargo:rustc-link-arg=-Wl,--allow-multiple-definition");
    }

    // 2. fftools must be linked BEFORE the FFmpeg libs it calls into (static link is left→right).
    println!("cargo:rustc-link-search=native={}", dist_lib.display());
    println!("cargo:rustc-link-lib=static=fftools");

    // Relink whenever the embedded FFmpeg archive changes. Cargo otherwise only tracks .rs/.c sources,
    // so a FFmpeg/deps rebuild (new codecs, e.g. libopenh264) under the SAME pkg-config path would be
    // silently ignored — the cdylib would keep the stale FFmpeg statically linked in.
    println!("cargo:rerun-if-changed={}/libfftools.a", dist_lib.display());

    // 3. FFmpeg + freetype + transitive system libs (mediandk/android/log/m on Android) come from the
    //    .pc files' Libs.private (PKG_CONFIG_ALL_STATIC=1). avfilter first → it depends on the rest.
    for lib in [
        "libavdevice",
        "libavfilter",
        "libavformat",
        "libavcodec",
        "libswscale",
        "libswresample",
        "libavutil",
    ] {
        pkg_config::Config::new()
            .statik(true)
            .cargo_metadata(true)
            .probe(lib)
            .unwrap_or_else(|e| panic!("pkg-config failed for {lib} (PKG_CONFIG_PATH={pc}): {e}"));
    }

    // Host (brew) libfreetype is built with PNG-sbit support, so it pulls libpng/z/bz2. The Android
    // freetype is built --without-png (build-deps.sh), so this is host-test-only.
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        for dir in ["/opt/homebrew/opt/libpng/lib", "/opt/homebrew/lib"] {
            println!("cargo:rustc-link-search=native={dir}");
        }
        for lib in ["png16", "z", "bz2"] {
            println!("cargo:rustc-link-lib=dylib={lib}");
        }
        // libavfilter.pc only lists `-lharfbuzz` (flat), so pkg-config never resolves harfbuzz's OWN
        // Requires.private. The brew harfbuzz is built with the graphite2 + CoreText shaper backends,
        // whose symbols then go unresolved. Probe harfbuzz directly so its full dep tree (graphite2,
        // glib, freetype, ApplicationServices/CoreText) is linked. Host-test-only (the Android/iOS
        // harfbuzz from build-deps.sh has no such backends).
        pkg_config::Config::new().statik(true).cargo_metadata(true).probe("harfbuzz").ok();

        // brew openh264 ships only a dylib (no static .a), so the static libavcodec probe above leaves
        // the Wels* encoder/decoder symbols unresolved. Link it dynamically for the host test; Android
        // statically embeds its own libopenh264 (build-deps.sh) and iOS drops it for videotoolbox.
        println!("cargo:rustc-link-search=native=/opt/homebrew/opt/openh264/lib");
        println!("cargo:rustc-link-lib=dylib=openh264");

        // Same story for libvpx (`--enable-libvpx`, the WebM/VP9-alpha decoder): the brew build is a
        // dylib, so link it dynamically for the host test. Android/iOS statically embed their own
        // libvpx via build-deps.sh / build-deps-ios.sh (resolved through FFmpeg's .pc Libs.private).
        println!("cargo:rustc-link-search=native=/opt/homebrew/opt/libvpx/lib");
        println!("cargo:rustc-link-lib=dylib=vpx");
    }
}
