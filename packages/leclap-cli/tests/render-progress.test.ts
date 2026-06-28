import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LiveRenderer } from '../src/render-progress';

// A fake TTY write stream that records every chunk so we can assert on the ANSI control sequences the
// LiveRenderer emits (cursor moves, clears) without needing a real terminal.
function fakeStream(columns = 80): NodeJS.WriteStream & { chunks: string[] } {
  const chunks: string[] = [];
  return {
    columns,
    write: (chunk: string) => {
      chunks.push(chunk);
      return true;
    },
    chunks,
  } as unknown as NodeJS.WriteStream & { chunks: string[] };
}

describe('LiveRenderer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('paints a header with label, percent and a timeline scrubber', () => {
    const stream = fakeStream();
    const live = new LiveRenderer('Rendering demo…', stream);

    live.start();
    live.update(0.5);
    vi.advanceTimersByTime(80); // one animation frame → repaint

    const out = stream.chunks.join('');
    expect(out).toContain('Rendering demo…');
    expect(out).toContain('50%');
    expect(out).toContain('◆'); // playhead
    expect(out).toContain('━'); // played track
    expect(out).toContain('┄'); // un-played track
  });

  it('shows the most recent log lines in the tail (bounded) and never debug-floods width', () => {
    const stream = fakeStream(40);
    const live = new LiveRenderer('Rendering…', stream);

    live.start();
    for (let i = 0; i < 10; i++) live.pushLog(`step ${i}`);
    vi.advanceTimersByTime(80);

    const out = stream.chunks.join('');
    // Ring buffer keeps the last 6 — earliest are dropped, latest kept.
    expect(out).not.toContain('step 0');
    expect(out).toContain('step 9');
  });

  it('finishSuccess erases the live block (cursor-up + clear) and prints only the summary', () => {
    const stream = fakeStream();
    const live = new LiveRenderer('Rendering…', stream);

    live.start();
    live.pushLog('intro finalized');
    vi.advanceTimersByTime(80);

    live.finishSuccess('✓ Rendered → build/output.mp4 (1.2s)');

    const tail = stream.chunks.slice(-2).join('');
    // An erase sequence (move up N lines) precedes the final write…
    const esc = String.fromCodePoint(0x1b);
    expect(stream.chunks.join('')).toMatch(new RegExp(`${esc}\\[\\d+A`));
    // …and the collapsed output is just the summary, not the prior tail line.
    expect(tail).toContain('✓ Rendered → build/output.mp4 (1.2s)');
    expect(tail).not.toContain('intro finalized');
    // Cursor is restored.
    expect(stream.chunks.join('')).toContain('\x1b[?25h');
  });

  it('finishError keeps the tail visible (no final erase past the last paint)', () => {
    const stream = fakeStream();
    const live = new LiveRenderer('Rendering…', stream);

    live.start();
    live.pushLog('ffmpeg failed: boom');
    vi.advanceTimersByTime(80);

    live.finishError();

    const out = stream.chunks.join('');
    expect(out).toContain('ffmpeg failed: boom');
    expect(out).toContain('\x1b[?25h');
  });
});
