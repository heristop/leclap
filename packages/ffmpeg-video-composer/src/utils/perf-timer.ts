export interface PerfSpan {
  label: string;
  ms: number;
  count: number;
}

export interface PerfReport {
  totalMs: number;
  spans: PerfSpan[];
}

const nowMs = (): number => Number(process.hrtime.bigint()) / 1_000_000;

/**
 * Lightweight, allocation-free-when-disabled phase timer. Records named spans using the
 * monotonic high-resolution clock and aggregates repeated labels (label + total ms + count).
 * Disabled instances are pure no-ops so production paths pay only a boolean check.
 */
export class PerfTimer {
  private readonly open = new Map<string, number>();
  private readonly totals = new Map<string, PerfSpan>();
  private readonly createdAt = nowMs();

  constructor(private readonly enabled: boolean) {}

  start(label: string): void {
    if (!this.enabled) {
      return;
    }

    this.open.set(label, nowMs());
  }

  end(label: string): void {
    if (!this.enabled) {
      return;
    }

    const started = this.open.get(label);

    if (started === undefined) {
      return;
    }

    this.open.delete(label);

    const elapsed = nowMs() - started;
    const existing = this.totals.get(label) ?? { label, ms: 0, count: 0 };
    existing.ms += elapsed;
    existing.count += 1;
    this.totals.set(label, existing);
  }

  async span<T>(label: string, fn: () => T | Promise<T>): Promise<T> {
    if (!this.enabled) {
      return fn();
    }

    this.start(label);

    try {
      return await fn();
    } finally {
      this.end(label);
    }
  }

  report(): PerfReport {
    if (!this.enabled) {
      return { totalMs: 0, spans: [] };
    }

    return {
      totalMs: nowMs() - this.createdAt,
      spans: [...this.totals.values()].sort((a, b) => b.ms - a.ms),
    };
  }
}

export const createPerfTimer = (): PerfTimer => {
  const flag = process.env.FVC_PERF;

  return new PerfTimer(Boolean(flag) && flag !== '0');
};

// Process-wide timer shared by the pipeline (director, segment builder, ffmpeg adapter,
// video editor) without threading a DI token through three entry points and the
// bridge-built adapters. `resetPerfTimer()` starts a fresh per-run timer; consumers read
// the current one via `getPerfTimer()`.
let shared: PerfTimer | null = null;

export const getPerfTimer = (): PerfTimer => {
  shared ??= createPerfTimer();

  return shared;
};

export const resetPerfTimer = (): PerfTimer => {
  shared = createPerfTimer();

  return shared;
};
