import { Writable } from 'node:stream';

// CRITICAL stdio safety. The MCP stdio transport frames JSON-RPC on fd 1; any stray
// `console.log` (from us, the core, or a dependency) would interleave with that framing and
// corrupt the protocol.
//
// Mechanism (the SDK's `StdioServerTransport` constructor accepts `(stdin?, stdout?)` stream
// overrides — verified against node_modules/.../server/stdio.d.ts):
//   1. Capture the genuine fd-1 writer BEFORE redirecting (`process.stdout.write` bound to
//      the real stream).
//   2. Repoint `process.stdout.write` at stderr, so any `console.log` lands on fd 2 and can
//      never touch the protocol stream.
//   3. Return a `Writable` that forwards to the captured real writer (genuine fd 1). The
//      caller hands this to the transport, so JSON-RPC framing still reaches fd 1 while
//      everyone else's stdout is diverted to stderr.
export function installStdoutGuard(): Writable {
  const realWrite = process.stdout.write.bind(process.stdout);

  process.stdout.write = ((chunk: unknown, encoding?: unknown, callback?: unknown): boolean =>
    (process.stderr.write as (...args: unknown[]) => boolean)(
      chunk,
      encoding,
      callback
    )) as typeof process.stdout.write;

  return new Writable({
    write(chunk: unknown, encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
      realWrite(chunk as string | Uint8Array, encoding, callback);
    },
  });
}
