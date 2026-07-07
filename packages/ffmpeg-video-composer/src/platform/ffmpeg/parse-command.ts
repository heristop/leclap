/**
 * Split an FFmpeg command string into an argv array, honouring quotes. Tracks the actual quote
 * character so a different quote inside a quoted span (e.g. a single quote inside a double-quoted
 * `-filter_complex`) is kept literal — which the filtergraph needs for values like `text='Hello'`.
 *
 * Shared by the adapters that bridge the core's CLI command strings to an argv-based runner
 * (FFmpegWasmAdapter → ffmpeg.wasm, FFmpegLeclapAdapter → the native engine).
 */
export function parseCommand(command: string): string[] {
  const args: string[] = [];
  let current = '';
  let quoteChar: string | null = null;

  const flush = (): void => {
    if (current.trim()) {
      args.push(current.trim());
    }
    current = '';
  };

  for (const char of command) {
    if (quoteChar !== null) {
      current += char === quoteChar ? '' : char;
      quoteChar = char === quoteChar ? null : quoteChar;
      continue;
    }

    if (char === '"' || char === "'") {
      quoteChar = char;
      continue;
    }

    if (char === ' ') {
      flush();
      continue;
    }

    current += char;
  }

  if (quoteChar !== null) {
    throw new Error(`Unterminated quote in command: ${command}`);
  }

  flush();

  return args;
}
