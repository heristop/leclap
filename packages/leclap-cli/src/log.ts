// Set the engine's log level for this process so the CLI owns the terminal output. The core's
// PinoLogAdapter reads `LECLAP_LOG_LEVEL` when it's constructed (during `compile()`), so this must
// run before the engine starts.
export function setEngineLogLevel(level: 'silent' | 'info'): void {
  process.env.LECLAP_LOG_LEVEL = level;
}
