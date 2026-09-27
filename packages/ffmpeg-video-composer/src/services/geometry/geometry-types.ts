import type { ApproxReason } from './text-measure';

// A positioned piece of text with the window during which it is on screen. Rules read these; nothing
// here judges anything.
export interface Box {
  path: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  // The type size the engine renders at — carried because `height` also includes box padding.
  fontSize: number;
  startSec: number;
  endSec: number;
  approx: boolean;
  approxReason?: ApproxReason;
  // The text colour token, or `null` when missing/unreadable — never a guess.
  color: string | null;
  // What the text sits on — its own box, over any earlier panels, over the section background — or
  // `null` when unknowable (footage, an image, an unparseable colour).
  backdrop: string | null;
  // A box, outline or shadow that draws something. The over-footage rule fires only when false.
  legibilityAid: boolean;
  // Whether `y` is the author's to change (a caption's `position`, an authored filter). The title-safe
  // rule skips the vertical axis otherwise: a finding the author cannot act on is noise.
  verticalPositionAuthored: boolean;
  // The side a preset pins at a fixed distance from the frame edge whatever the text says; the
  // title-safe rule judges only the side the text grows toward. Read off the filter: `x` that ignores
  // text_w is pinned left, `x` that moves with it one-for-one is pinned right.
  anchoredSide?: 'left' | 'right';
  // Whether this window rests on ASSUMED_DURATION_SEC (this section or an earlier one has no duration).
  timingAssumed: boolean;
  // Draw order within the section: a panel drawn after the text paints over it.
  sectionIndex: number;
  drawIndex: number;
}

// A filled drawbox: a band, a pill, an accent bar, an authored card.
export interface Panel {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  startSec: number;
  endSec: number;
  sectionIndex: number;
  drawIndex: number;
}

export interface Canvas {
  width: number;
  height: number;
}
