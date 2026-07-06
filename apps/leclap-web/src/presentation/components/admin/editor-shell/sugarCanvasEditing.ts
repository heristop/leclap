// Pure editing/drag logic for direct manipulation of the sugar blocks on the canvas. The engine's
// sugar is structural — a titleCard has an align enum, a lowerThird/caption a position enum, and
// each line is a fixed slot — so canvas gestures translate to those descriptor-legal fields:
// double-click edits one line's text, dragging snaps to the nearest allowed slot. Free x/y needs
// the "Detach into text elements" conversion (sugarToOverlays).
import type { EditorCaption, LowerThird, TitleCard } from '../templateEditorModel';
import type { SugarKind } from './sectionElements';
import { translationText } from './sugarPreviewGeometry';

type AnySugar = EditorCaption | TitleCard | LowerThird;

// The editable line slots per sugar kind, in draw order. These double as the preview line keys
// (SugarTextLine.key), so the canvas can map a clicked line back to its descriptor field.
const LINE_KEYS: Record<SugarKind, ReadonlyArray<string>> = {
  titleCard: ['kicker', 'headline', 'subtitle'],
  lowerThird: ['title', 'subtitle', 'badge'],
  caption: ['caption'],
};

export function sugarLineKeys(kind: SugarKind): ReadonlyArray<string> {
  return LINE_KEYS[kind];
}

// A Translation record field of a titleCard/lowerThird, by line key.
function translationLine(sugar: AnySugar, lineKey: string): Record<string, string> | undefined {
  return (sugar as Record<string, Record<string, string> | undefined>)[lineKey];
}

/** The current display text of one sugar line (seed for the inline editor). */
export function sugarLineText(kind: SugarKind, sugar: AnySugar, lineKey: string): string {
  if (kind === 'caption') return (sugar as EditorCaption).text;

  return translationText(translationLine(sugar, lineKey));
}

// True when any of the block's line slots still carries text.
function hasAnyLine(kind: SugarKind, sugar: AnySugar): boolean {
  if (kind === 'caption') return (sugar as EditorCaption).text.trim() !== '';

  return LINE_KEYS[kind].some((key) => translationText(translationLine(sugar, key)).trim() !== '');
}

/**
 * Commits an inline edit of one sugar line: writes the field (titleCard/lowerThird lines as
 * `{ en }` records, caption.text as a plain string), clearing the line on blank text and the WHOLE
 * block (undefined) when no line remains — mirroring the scene-field editors' clearing rules.
 */
export function commitSugarLine(
  kind: SugarKind,
  sugar: AnySugar,
  lineKey: string,
  value: string
): AnySugar | undefined {
  if (kind === 'caption') {
    const next: EditorCaption = { ...(sugar as EditorCaption), text: value.trim() === '' ? '' : value };

    return hasAnyLine(kind, next) ? next : undefined;
  }

  const line = value.trim() === '' ? undefined : { en: value };
  const next = { ...sugar, [lineKey]: line } as AnySugar;

  return hasAnyLine(kind, next) ? next : undefined;
}

// Representative vertical centres of the caption position slots (fractions of the frame height, from
// the engine offsets: top 60px, centered, lower-third 110px above bottom, bottom 60px). The drag
// snaps to whichever slot centre is nearest the pointer.
const CAPTION_SLOTS: ReadonlyArray<{ position: NonNullable<EditorCaption['position']>; y: number }> = [
  { position: 'top', y: 0.1 },
  { position: 'center', y: 0.5 },
  { position: 'lower-third', y: 0.8 },
  { position: 'bottom', y: 0.92 },
];

export function snapCaptionPosition(yFrac: number): NonNullable<EditorCaption['position']> {
  const nearest = [...CAPTION_SLOTS].sort((a, b) => Math.abs(a.y - yFrac) - Math.abs(b.y - yFrac))[0];

  return nearest.position;
}

export function snapLowerThirdPosition(yFrac: number): NonNullable<LowerThird['position']> {
  return yFrac < 0.5 ? 'top' : 'bottom';
}

// The title card snaps between its two legal aligns; the midpoint sits between the left margin
// (x ≈ 0.06) and the centre (0.5).
export function snapTitleCardAlign(xFrac: number): NonNullable<TitleCard['align']> {
  return xFrac < 0.28 ? 'left' : 'center';
}

/**
 * The patched sugar for a drag released at `point` (frame fractions): the caption/lowerThird snap
 * their position slot, the titleCard its align. Always returns a value — a drag never clears sugar.
 */
export function sugarDragPatch(kind: SugarKind, sugar: AnySugar, point: { x: number; y: number }): AnySugar {
  if (kind === 'caption') return { ...(sugar as EditorCaption), position: snapCaptionPosition(point.y) };

  if (kind === 'lowerThird') return { ...(sugar as LowerThird), position: snapLowerThirdPosition(point.y) };

  return { ...(sugar as TitleCard), align: snapTitleCardAlign(point.x) };
}
