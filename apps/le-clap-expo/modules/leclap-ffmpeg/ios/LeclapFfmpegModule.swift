import ExpoModulesCore

// Bridges the embedded FFmpeg CLI engine (Rust + fftools, statically linked into
// libleclap_ffmpeg_core.a) to JS — the iOS counterpart of the Android Kotlin module. `run`/`probe`
// block for the whole job, so they run off the JS thread via AsyncFunction. The free functions
// `version()`, `run(args:)`, `probe(args:)` come from the uniffi-generated binding (Generated/).
public class LeclapFfmpegModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LeclapFfmpeg")

    Function("version") {
      return version()
    }

    AsyncFunction("run") { (args: [String]) -> [String: Any] in
      let result = run(args: args)
      return ["code": result.code, "log": result.log]
    }

    AsyncFunction("probe") { (args: [String]) -> [String: Any] in
      let result = probe(args: args)
      return ["code": result.code, "output": result.output]
    }
  }
}
