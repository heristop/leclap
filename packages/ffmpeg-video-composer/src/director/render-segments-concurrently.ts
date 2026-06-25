import type { Section } from '@/core/types';
import { runWithConcurrency } from '../utils/concurrency';
import type SegmentBuilder from '../editor/SegmentBuilder';
import type AbstractLogger from '../platform/logging/AbstractLogger';

type Built = { section: Section; segment: SegmentBuilder };

// Default segments rendered in parallel on adapters that support concurrent execute (Node/static).
const DEFAULT_RENDER_CONCURRENCY = 3;

// Effective parallel-render width: 1 (serial) unless the adapter spawns independent processes, in
// which case the requested value (default 3) capped by the segment count.
export const resolveRenderConcurrency = (
  supportsConcurrentExecute: boolean,
  requested: number | undefined,
  segmentCount: number
): number => {
  if (!supportsConcurrentExecute) {
    return 1;
  }

  return Math.max(1, Math.min(requested ?? DEFAULT_RENDER_CONCURRENCY, segmentCount));
};

export interface SerialRenderContext {
  segments: Section[];
  totalLength: number;
  durations: Record<string, number>;
  isStopped: () => boolean;
  // Set/clear the adapter's per-segment progress forwarding (listener + expected duration).
  setSegmentProgress: (listener: ((fraction: number) => void) | undefined, expectedSeconds: number | undefined) => void;
  emitProgress: (fraction: number) => void;
  processSegment: (section: Section) => Promise<unknown>;
}

/**
 * Render segments one at a time, forwarding each segment's fine-grained ffmpeg progress (0..1)
 * interpolated within its share of the total duration. This is the path for adapters that drive a
 * single engine (WASM, on-device) or whenever concurrency resolves to 1.
 */
export const renderSegmentsSerially = async (ctx: SerialRenderContext): Promise<void> => {
  let accumulated = 0;

  await ctx.segments.reduce(async (chain, segment) => {
    await chain;

    if (ctx.isStopped()) {
      return;
    }

    const segmentLength = ctx.durations[segment.name] ?? 0;
    // Matches the boundary value emitted after the segment, so the bar climbs continuously.
    ctx.setSegmentProgress((fraction) => {
      if (ctx.totalLength <= 0) {
        return;
      }

      const frac = Math.min(Math.max(fraction, 0), 1);
      ctx.emitProgress(Math.min(1, (accumulated + frac * segmentLength) / ctx.totalLength));
    }, segmentLength);

    try {
      await ctx.processSegment(segment);
    } finally {
      ctx.setSegmentProgress(undefined, undefined);
    }

    accumulated += segmentLength;
  }, Promise.resolve());
};

export interface ParallelRenderContext {
  segments: Section[];
  isStopped: () => boolean;
  build: (section: Section) => Promise<SegmentBuilder>;
  render: (segment: SegmentBuilder, section: Section) => Promise<void>;
  // Called on the main thread after each segment renders (progress + logging).
  afterRender: (section: Section) => void;
  // Music track + concat-list append; run in original order after all renders.
  finalizeSegment: (section: Section) => Promise<void>;
  logger: AbstractLogger;
}

// Superset context for the single render entry point: carries both the serial and the parallel
// fields so the director builds one object and `renderSegments` dispatches by effective width.
export interface RenderSegmentsContext extends SerialRenderContext, ParallelRenderContext {
  supportsConcurrentExecute: boolean;
  maxRenderConcurrency: number | undefined;
}

// Single render entry: resolve the effective concurrency, then run serially (1) or via the pool.
export const renderSegments = async (ctx: RenderSegmentsContext): Promise<void> => {
  const concurrency = resolveRenderConcurrency(
    ctx.supportsConcurrentExecute,
    ctx.maxRenderConcurrency,
    ctx.segments.length
  );
  ctx.logger.info(`[TemplateDirection] Render concurrency: ${concurrency}`);

  if (concurrency === 1) {
    await renderSegmentsSerially(ctx);

    return;
  }

  await renderSegmentsConcurrently(ctx, concurrency);
};

/**
 * Render segments with bounded concurrency. Build runs serially first (it mutates the shared
 * `Segment` DI singleton, so it must not overlap), capturing each segment's ffmpeg command +
 * destination on its handle; renders then run through a bounded pool; concat-list appends happen in
 * original segment order. Falls back to serial rendering when two segments resolve to the same
 * output path (duplicate section names) — concurrent writes to one file corrupt it.
 */
export const renderSegmentsConcurrently = async (ctx: ParallelRenderContext, concurrency: number): Promise<void> => {
  const built = await ctx.segments.reduce(async (chain, section) => {
    const acc = await chain;

    if (ctx.isStopped()) {
      return acc;
    }

    acc.push({ section, segment: await ctx.build(section) });

    return acc;
  }, Promise.resolve<Built[]>([]));

  const destinations = built.map((b) => b.segment.destination);
  const effective = new Set(destinations).size === destinations.length ? concurrency : 1;

  if (effective !== concurrency) {
    ctx.logger.warn('[TemplateDirection] Duplicate segment output paths detected; rendering serially');
  }

  await runWithConcurrency(built, effective, async ({ segment, section }) => {
    if (ctx.isStopped()) {
      return;
    }

    await ctx.render(segment, section);
    ctx.afterRender(section);
  });

  await built.reduce(async (chain, { section }) => {
    await chain;
    await ctx.finalizeSegment(section);
  }, Promise.resolve());
};
