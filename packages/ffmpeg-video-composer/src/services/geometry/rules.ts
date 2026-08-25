import { contrastRatio, parseColor } from '@/core/color-contrast';
import type { Box, Canvas } from './text-boxes';

// Advisory only. Nothing here is ever an `error`: a template that renders badly still renders, and
// failing a build over a legibility hint would make `leclap validate` unusable in CI.
export interface GeometryWarning {
  path: string;
  message: string;
  code: string;
  severity: 'warn';
  approx: boolean;
}

// Broadcast title-safe: keep text inside the middle 90%.
const SAFE_MARGIN_RATIO = 0.05;

// Below this fraction of the output height, type is unreadable on a phone.
const MIN_LEGIBLE_RATIO = 0.025;

function warn(box: Box, code: string, message: string): GeometryWarning {
  return { path: box.path, message, code, severity: 'warn', approx: box.approx };
}

// Below this, an "overflow" is inside the noise of the measurement itself — the difference between
// one digit and another in the variable a caption interpolates. Reporting it produced findings that
// read "overflows the safe width by 0px", which tells an author nothing they can act on.
const OVERFLOW_TOLERANCE_PX = 2;

// How far the box pokes out of the given inset rectangle, on whichever of the four sides is worst.
// Position matters as much as size: a left-aligned caption 1140px wide fits inside a 1152px safe
// width and still crosses the right-hand margin, because it starts at x=80 rather than at x=64.
// Comparing width against a budget — which is all the first version did — fires only for centred text.
function insetExcess(box: Box, canvas: Canvas, inset: number): number {
  return Math.max(
    inset - box.x,
    box.x + box.width - (canvas.width - inset),
    inset - box.y,
    box.y + box.height - (canvas.height - inset)
  );
}

function frameExcess(box: Box, canvas: Canvas): number {
  return insetExcess(box, canvas, 0);
}

// Broadcast title-safe: the middle 90% of the frame.
function safeAreaExcess(box: Box, canvas: Canvas): number {
  return insetExcess(box, canvas, canvas.width * SAFE_MARGIN_RATIO);
}

export function overflowWarnings(boxes: Box[], canvas: Canvas): GeometryWarning[] {
  const warnings: GeometryWarning[] = [];

  for (const box of boxes) {
    // A severity ladder, worst first: text past the frame edge is simply not on screen, whereas text
    // past the title-safe margin merely risks being cropped. Both carry a pixel count, because
    // "shorten it" is only actionable if the author knows by how much.
    const offFrame = Math.round(frameExcess(box, canvas));

    if (offFrame >= OVERFLOW_TOLERANCE_PX) {
      warnings.push(warn(box, 'text_out_of_frame', `${box.label}: extends ${offFrame}px past the frame edge`));
      continue;
    }

    const excess = Math.round(safeAreaExcess(box, canvas));

    if (excess >= OVERFLOW_TOLERANCE_PX) {
      // "extends Npx past", not "overflows by Npx": N is how far the box pokes out on its worst
      // side, which for centred text is half the width that would have to come off. Phrasing it as
      // an amount to remove would understate the edit by exactly a factor of two.
      warnings.push(
        warn(
          box,
          'text_overflow',
          `${box.label}: extends ${excess}px past the title-safe margin — shorten it or reduce the size`
        )
      );
    }
  }

  return warnings;
}

export function legibilityWarnings(boxes: Box[], canvas: Canvas): GeometryWarning[] {
  const warnings: GeometryWarning[] = [];
  const floor = canvas.height * MIN_LEGIBLE_RATIO;

  for (const box of boxes) {
    const fontSize = box.fontSize;

    if (fontSize >= floor) {
      continue;
    }

    const percent = ((fontSize / canvas.height) * 100).toFixed(1);

    warnings.push(
      warn(
        box,
        'text_too_small',
        `${box.label}: ${Math.round(fontSize)}px is ${percent}% of frame height (minimum ${(MIN_LEGIBLE_RATIO * 100).toFixed(1)}%)`
      )
    );
  }

  return warnings;
}

// WCAG AA for large text (the 4.5:1 minimum is for normal text; captions/lower-thirds/title cards
// all render well above that size threshold).
const MIN_TEXT_CONTRAST = 3.0;

// Exact colour tokens, not font metrics, so a finding here is never an estimate: `approx` is
// always false regardless of the box's own approx flag.
export function contrastWarnings(boxes: Box[]): GeometryWarning[] {
  const warnings: GeometryWarning[] = [];

  for (const box of boxes) {
    if (!box.color || !box.backdrop) {
      continue;
    }

    const text = parseColor(box.color);
    const backdrop = parseColor(box.backdrop);

    if (!text || !backdrop) {
      continue;
    }

    const ratio = contrastRatio(text.rgb, backdrop.rgb);

    if (ratio >= MIN_TEXT_CONTRAST) {
      continue;
    }

    warnings.push({
      path: box.path,
      message: `${box.path}: ${box.color} on ${box.backdrop} — contrast ${ratio.toFixed(1)}:1, below the ${MIN_TEXT_CONTRAST}:1 minimum`,
      code: 'text_low_contrast',
      severity: 'warn',
      approx: false,
    });
  }

  return warnings;
}

// Fires only on the conjunction: unknown backdrop (footage/image, or an unparseable custom colour)
// AND no box/band AND no shadow/outline. Any one of those is the author having already handled
// legibility, so warning anyway would fire on most templates and turn the report into noise.
export function footageLegibilityWarnings(boxes: Box[]): GeometryWarning[] {
  const warnings: GeometryWarning[] = [];

  for (const box of boxes) {
    if (box.backdrop !== null || box.legibilityAid) {
      continue;
    }

    warnings.push({
      path: box.path,
      message: `${box.path}: drawn over footage with no box, shadow or outline — legibility depends on the clip`,
      code: 'text_unreadable_over_footage',
      severity: 'warn',
      approx: false,
    });
  }

  return warnings;
}

function overlapsInTime(a: Box, b: Box): number {
  const start = Math.max(a.startSec, b.startSec);
  const end = Math.min(a.endSec, b.endSec);

  return end - start;
}

function overlapsInSpace(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

// A collision needs both dimensions. Two captions in the same place at different moments are the
// normal way a template works — reporting those would bury the real findings in noise.
//
// `collectBoxes` emits boxes in non-decreasing `startSec` (its cursor only ever advances), so once
// `b` starts at or after `a` ends, no later box can overlap `a` either and the inner scan is done.
// That turns the pairwise sweep from quadratic into roughly linear: 200 captioned sections drop from
// ~180k comparisons to a few hundred.
export function collisionWarnings(boxes: Box[], limit = Number.POSITIVE_INFINITY): GeometryWarning[] {
  const warnings: GeometryWarning[] = [];

  for (let i = 0; i < boxes.length && warnings.length < limit; i++) {
    const a = boxes[i];

    for (let j = i + 1; j < boxes.length && warnings.length < limit; j++) {
      const b = boxes[j];

      if (b.startSec >= a.endSec) {
        break;
      }

      const shared = overlapsInTime(a, b);

      if (shared <= 0 || !overlapsInSpace(a, b)) {
        continue;
      }

      warnings.push({
        path: a.path,
        message: `${a.label} overlaps ${b.label} for ${shared.toFixed(1)}s`,
        code: 'text_collision',
        severity: 'warn',
        approx: a.approx || b.approx,
      });
    }
  }

  return warnings;
}
