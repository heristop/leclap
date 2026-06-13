import ExpoModulesCore
import UIKit

// Bridges the embedded FFmpeg CLI engine (Rust + fftools, statically linked into
// libleclap_ffmpeg_core.a) to JS — the iOS counterpart of the Android Kotlin module. `run`/`probe`
// block for the whole job, so they run off the JS thread via AsyncFunction. The free functions
// `version()`, `run(args:)`, `probe(args:)` come from the uniffi-generated binding (Generated/).
public class LeclapFfmpegModule: Module {
  // Run a blocking native call inside a UIBackgroundTask so a render in flight when the app is
  // backgrounded gets the OS grace window (~30s) to finish instead of being suspended mid-encode.
  // If that window is about to expire, request a cooperative cancel so ffmpeg exits cleanly
  // (code 255) rather than leaving a half-written file. UIApplication must be touched on the main
  // thread; the AsyncFunction body runs off it, so begin/end hop to main.
  private func withBackgroundTask<T>(_ name: String, _ work: () -> T) -> T {
    var taskId: UIBackgroundTaskIdentifier = .invalid

    let endTask = {
      DispatchQueue.main.async {
        guard taskId != .invalid else { return }
        UIApplication.shared.endBackgroundTask(taskId)
        taskId = .invalid
      }
    }

    DispatchQueue.main.sync {
      taskId = UIApplication.shared.beginBackgroundTask(withName: name) {
        cancel()
        endTask()
      }
    }

    defer { endTask() }
    return work()
  }

  public func definition() -> ModuleDefinition {
    Name("LeclapFfmpeg")

    Function("version") {
      return version()
    }

    // Cooperative cancel: sets the static shutdown flags (same effect as SIGTERM); returns before ffmpeg exits.
    Function("cancel") {
      cancel()
    }

    AsyncFunction("run") { (args: [String]) -> [String: Any] in
      let result = self.withBackgroundTask("LeclapFfmpegRender") {
        run(args: args)
      }
      return ["code": result.code, "log": result.log]
    }

    AsyncFunction("probe") { (args: [String]) -> [String: Any] in
      let result = probe(args: args)
      return ["code": result.code, "output": result.output]
    }
  }
}
