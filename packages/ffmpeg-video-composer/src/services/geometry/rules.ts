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

export function overflowWarnings(boxes: Box[], canvas: Canvas): GeometryWarning[] {
  const warnings: GeometryWarning[] = [];
  const usable = canvas.width * (1 - SAFE_MARGIN_RATIO * 2);

  for (const box of boxes) {
    if (box.width > usable) {
      const excess = Math.round(box.width - usable);

      warnings.push(
        warn(
          box,
          'text_overflow',
          `${box.label}: overflows the safe width by ${excess}px — shorten it or reduce the size`
        )
      );
      continue;
    }

    const runsOff = box.x < 0 || box.x + box.width > canvas.width || box.y < 0 || box.y + box.height > canvas.height;

    if (runsOff) {
      warnings.push(warn(box, 'text_out_of_frame', `${box.label}: extends past the frame edge`));
    }
  }

  return warnings;
}

export function legibilityWarnings(boxes: Box[], canvas: Canvas): GeometryWarning[] {
  const warnings: GeometryWarning[] = [];
  const floor = canvas.height * MIN_LEGIBLE_RATIO;

  for (const box of boxes) {
    // Box height is the font size plus leading; recover the size to report something recognisable.
    const fontSize = box.height / 1.2;

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
export function collisionWarnings(boxes: Box[]): GeometryWarning[] {
  const warnings: GeometryWarning[] = [];

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
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
