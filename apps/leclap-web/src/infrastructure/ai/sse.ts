// Minimal Server-Sent Events reader over a fetch body: splits the byte stream into events and hands
// each `{ event, data }` to the caller. Enough for the AI streaming APIs (single-line JSON data,
// optional `event:` names); comments and retry fields are ignored.

export interface SseEvent {
  event: string;
  data: string;
}

// Parse one raw event block ("event: x\ndata: {...}") into an event, or null for comments/empty.
export function parseSseBlock(block: string): SseEvent | null {
  let event = 'message';
  const data: string[] = [];

  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();

    if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
  }

  return data.length > 0 ? { event, data: data.join('\n') } : null;
}

// Split buffered text into complete blocks; returns the blocks and the unfinished remainder.
export function splitSseBuffer(buffer: string): { blocks: string[]; rest: string } {
  const normalized = buffer.replace(/\r\n?/g, '\n');
  const parts = normalized.split('\n\n');
  const rest = parts.pop() ?? '';

  return { blocks: parts, rest };
}

function dispatch(blocks: string[], onEvent: (event: SseEvent) => void): void {
  for (const block of blocks) {
    const event = parseSseBlock(block);

    if (event) onEvent(event);
  }
}

async function pump(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  buffer: string,
  onEvent: (event: SseEvent) => void
): Promise<void> {
  const { done, value } = await reader.read();
  const text = buffer + (done ? decoder.decode() : decoder.decode(value, { stream: true }));

  if (done) {
    dispatch(splitSseBuffer(`${text}\n\n`).blocks, onEvent);

    return;
  }

  const { blocks, rest } = splitSseBuffer(text);
  dispatch(blocks, onEvent);
  await pump(reader, decoder, rest, onEvent);
}

export async function readSse(body: ReadableStream<Uint8Array>, onEvent: (event: SseEvent) => void): Promise<void> {
  const reader = body.getReader();

  try {
    await pump(reader, new TextDecoder(), '', onEvent);
  } finally {
    reader.releaseLock();
  }
}
