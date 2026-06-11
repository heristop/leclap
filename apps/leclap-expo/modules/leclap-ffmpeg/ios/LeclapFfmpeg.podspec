Pod::Spec.new do |s|
  s.name           = 'LeclapFfmpeg'
  s.version        = '1.0.0'
  s.summary        = 'On-device FFmpeg CLI engine (embedded FFmpeg + fftools via uniffi)'
  s.description    = 'The iOS native module for the embedded FFmpeg CLI engine used by leclap.'
  s.license        = 'MIT'
  s.author         = 'leclap'
  s.homepage       = 'https://github.com/heristop/ffmpeg-video-composer'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # The Expo module + the uniffi-generated Swift binding (both compiled into the pod's Swift module).
  s.source_files   = 'LeclapFfmpegModule.swift', 'Generated/leclap_ffmpeg_core.swift'
  # The FFI header + its modulemap are imported by the uniffi binding via `import leclap_ffmpeg_coreFFI`
  # (resolved through SWIFT_INCLUDE_PATHS below), not compiled directly.
  s.preserve_paths = 'Generated/leclap_ffmpeg_coreFFI.h', 'Generated/module.modulemap'

  # Self-contained static engine (Rust + fftools + FFmpeg + freetype + harfbuzz) as an xcframework:
  # device (ios-arm64) + simulator (ios-arm64_x86_64-simulator), so it links on real iPhones and the sim.
  # Built by packages/ffmpeg-engine/build-ios-lib.sh — NOT committed to git.
  s.vendored_frameworks = 'LeclapFfmpegCore.xcframework'

  # System frameworks/libs the engine pulls in (videotoolbox encoders, media muxing, libc++/z/bz2/iconv).
  s.frameworks = 'VideoToolbox', 'CoreMedia', 'CoreVideo', 'AudioToolbox', 'CoreFoundation',
                 'CoreServices', 'Security', 'Metal', 'CoreImage', 'Foundation'
  s.libraries  = 'c++', 'z', 'bz2', 'iconv'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    # Let the Swift compiler find Generated/module.modulemap so `import leclap_ffmpeg_coreFFI` resolves.
    'SWIFT_INCLUDE_PATHS' => '"$(PODS_TARGET_SRCROOT)/Generated"'
  }
end
