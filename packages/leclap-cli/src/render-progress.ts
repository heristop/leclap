import pc from 'picocolors';
import { accent, meter } from './theme.js';

// A live, in-place render region for an interactive TTY: a header line (spinner + label + progress bar
// + percent + elapsed) above a scrolling tail of the most recent engine/ffmpeg log lines. Each repaint
// rewinds over the previously printed block (cursor-up + clear-to-end) and reprints, so the detail
// "streams" without flooding scrollback. On success the whole block is erased and collapses to a single
// summary line; on error the tail is left on screen so the failing context stays visible.

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const BAR_WIDTH = 16;
const TAIL_SIZE = 6;
const FRAME_MS = 80;

const CURSOR_HIDE = '\x1b[?25l';
const CURSOR_SHOW = '\x1b[?25h';

export class LiveRenderer {
  private readonly stream: NodeJS.WriteStream;
  private readonly label: string;
  private readonly startedAt: number;
  private readonly tail: string[] = [];
  private fraction = 0;
  private frame = 0;
  private printedLines = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(label: string, stream: NodeJS.WriteStream = process.stdout) {
    this.label = label;
    this.stream = stream;
    this.startedAt = Date.now();
  }

  start(): void {
    this.stream.write(CURSOR_HIDE);
    this.paint();
    this.timer = setInterval(() => {
      this.frame = (this.frame + 1) % SPINNER_FRAMES.length;
      this.paint();
    }, FRAME_MS);
  }

  update(fraction: number): void {
    if (Number.isFinite(fraction)) this.fraction = Math.max(this.fraction, fraction);
  }

  pushLog(line: string): void {
    const trimmed = line.replace(/\s+$/, '');

    if (!trimmed) return;

    this.tail.push(trimmed);

    if (this.tail.length > TAIL_SIZE) this.tail.shift();
  }

  // Erase the live block and collapse to the single summary line.
  finishSuccess(summary: string): void {
    this.stop();
    this.erase();
    this.stream.write(`${summary}\n${CURSOR_SHOW}`);
  }

  // Stop animating but leave the last painted block (header + tail) on screen so the failure context
  // is preserved; the caller prints the error report below it.
  finishError(): void {
    this.stop();
    this.paint();
    this.stream.write(CURSOR_SHOW);
  }

  private stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private erase(): void {
    if (this.printedLines === 0) return;
    this.stream.write(`\x1b[${this.printedLines}A\r\x1b[0J`);
    this.printedLines = 0;
  }

  private paint(): void {
    this.erase();

    // `columns` can be 0 or undefined on some ptys; both fall back to 80, and a 40-col floor keeps the
    // tail from collapsing to nothing (truncate() empties anything narrower than its prefix).
    const columns = (this.stream as { columns?: number }).columns;
    const width = Math.max(40, columns && columns > 0 ? columns : 80);
    const spinner = accent(SPINNER_FRAMES[this.frame]);
    const pct = Math.round(Math.max(0, Math.min(1, this.fraction)) * 100);
    const elapsed = ((Date.now() - this.startedAt) / 1000).toFixed(1);
    const header = `${spinner} ${this.label}  ${meter(this.fraction, BAR_WIDTH)} ${pc.dim(`${pct}%`)}  ${pc.dim(`${elapsed}s`)}`;

    const lines = [header, ...this.tail.map((l) => `  ${pc.dim('›')} ${pc.dim(truncate(l, width - 4))}`)];
    this.stream.write(`${lines.join('\n')}\n`);
    this.printedLines = lines.length;
  }
}

function truncate(text: string, max: number): string {
  if (max <= 1) return '';

  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
