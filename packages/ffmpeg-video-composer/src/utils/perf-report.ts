import type { PerfReport } from './perf-timer';

export const ffmpegSharePct = (report: PerfReport): number => {
  if (report.totalMs <= 0) {
    return 0;
  }

  const ffmpegMs = report.spans.filter((s) => s.label.startsWith('ffmpeg:')).reduce((sum, s) => sum + s.ms, 0);

  return (ffmpegMs / report.totalMs) * 100;
};

export const formatPerfReport = (report: PerfReport): string => {
  const lines = report.spans.map((s) => {
    const pct = report.totalMs > 0 ? ((s.ms / report.totalMs) * 100).toFixed(1) : '0.0';

    return `${s.label.padEnd(28)} ${s.ms.toFixed(1).padStart(10)}ms ${String(s.count).padStart(4)}x ${pct.padStart(6)}%`;
  });

  return [`total ${report.totalMs.toFixed(1)}ms · ffmpeg share ${ffmpegSharePct(report).toFixed(1)}%`, ...lines].join(
    '\n'
  );
};
