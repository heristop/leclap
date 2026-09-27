// The compile service reports progress in English (`stage` and a free-form `currentStep`, see
// coreCompilationService). The display translates rather than prints them: every viewer outside
// English otherwise watched the whole render narrate itself in English.

const STAGE_KEYS = {
  Initializing: 'progress.stage.initializing',
  Editing: 'progress.stage.editing',
  Preparing: 'progress.stage.preparing',
  Configuring: 'progress.stage.configuring',
  Processing: 'progress.stage.processing',
  Compiling: 'progress.stage.compiling',
  Finalizing: 'progress.stage.finalizing',
  Complete: 'progress.stage.complete',
  Error: 'progress.stage.error',
} as const;

type StageKey = (typeof STAGE_KEYS)[keyof typeof STAGE_KEYS] | 'progress.header.title';

const isKnownStage = (stage: string): stage is keyof typeof STAGE_KEYS => Object.hasOwn(STAGE_KEYS, stage);

/** The `process` key naming an engine stage; unknown stages get the generic headline. */
export const stageKey = (stage: string): StageKey =>
  isKnownStage(stage) ? STAGE_KEYS[stage] : 'progress.header.title';

// The creative kit's render quips (render-quips.ts), one key each and in the same order, so the web
// tells the same little journey as the phone app, in the viewer's language.
export const QUIP_KEYS = [
  'progress.quip.projector',
  'progress.quip.reels',
  'progress.quip.pixels',
  'progress.quip.soundtrack',
  'progress.quip.dance',
  'progress.quip.splice',
  'progress.quip.colors',
  'progress.quip.magic',
  'progress.quip.transitions',
  'progress.quip.frames',
  'progress.quip.mix',
  'progress.quip.finish',
  'progress.quip.carpet',
  'progress.quip.showtime',
] as const;

/** The quip for a percentage — bucketed like renderQuip, so a line holds within its band. */
export const quipKey = (percentage: number): (typeof QUIP_KEYS)[number] => {
  const fraction = Math.min(Math.max(percentage / 100, 0), 1);

  return QUIP_KEYS[Math.min(QUIP_KEYS.length - 1, Math.floor(fraction * QUIP_KEYS.length))];
};

// Elapsed / remaining time in the locale's own narrow units ("12s", "1 Min. 5 Sek.") — the hand-rolled
// "1m 5s" read as English everywhere.
export const formatDuration = (ms: number, locale: string): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const unit = (value: number, name: 'minute' | 'second'): string =>
    new Intl.NumberFormat(locale, { style: 'unit', unit: name, unitDisplay: 'narrow' }).format(value);

  if (minutes === 0) return unit(total, 'second');

  return `${unit(minutes, 'minute')} ${unit(total % 60, 'second')}`;
};

// Time left: the progress source's own estimate when it makes one (the builder's hook does), otherwise
// the same straight-line extrapolation from this display's clock — the onboarding and test-render
// sources report none, and "Estimating…" would have sat there for the whole render.
export const remainingMs = (
  elapsedMs: number,
  percentage: number,
  reported: number | undefined
): number | undefined => {
  if (reported !== undefined) return reported;

  if (percentage <= 0) return undefined;

  return (elapsedMs / percentage) * (100 - percentage);
};

// The remaining-time estimate is a straight-line extrapolation, so it is noise until the render has a
// few seconds and a few percent behind it (14% after one second read "~0s remaining"), and pointless
// in its last second.
export const etaVisible = (elapsedMs: number, percentage: number, remainingMs: number | undefined): boolean =>
  remainingMs !== undefined && elapsedMs >= 3000 && percentage >= 5 && percentage < 100 && remainingMs >= 1000;
