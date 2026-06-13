// Pure layout maths for the TimelineStrip: turn the editor sections into proportionally-sized
// chips (one per VISUAL section) plus the boundary transitions between them. No React/DOM
// dependency — unit-testable in node.
import type { EditorSection, EditorState, SectionTransition } from '../templateEditorModel';

export type TimelineKind = 'color' | 'image' | 'video';

export interface TimelineChip {
  // Editor-section index (so a click can scroll the matching card into view / reorder it).
  editorIndex: number;
  kind: TimelineKind;
  // Width as a percentage of the strip (0..100), proportional to the section's duration.
  widthPct: number;
  // Color swatch for color sections; undefined otherwise.
  color?: string;
  // The transition emitted into the next visual chip, if any (rendered at the boundary).
  transitionAfter?: SectionTransition;
}

const VISUAL_KINDS: ReadonlySet<EditorSection['kind']> = new Set(['color', 'image', 'video']);

// Visual sections always carry a duration; this narrows the type for width maths.
function durationOf(section: EditorSection): number {
  if ('duration' in section && typeof section.duration === 'number' && section.duration > 0) {
    return section.duration;
  }

  // Fallback weight so a section with an unknown/zero duration still claims a slice.
  return 1;
}

// Proportional chip widths in percent. When every duration is unknown they fall back to equal
// widths; otherwise each chip's width is its share of the total visual duration. The list always
// sums to ~100 (last chip absorbs rounding) so the strip fills edge-to-edge.
export function computeTimeline(state: EditorState): TimelineChip[] {
  const visual = state.sections
    .map((section, editorIndex) => ({ section, editorIndex }))
    .filter(({ section }) => VISUAL_KINDS.has(section.kind));

  if (visual.length === 0) return [];

  const durations = visual.map(({ section }) => durationOf(section));
  const total = durations.reduce((sum, d) => sum + d, 0);

  let allocated = 0;

  return visual.map(({ section, editorIndex }, i) => {
    const isLast = i === visual.length - 1;
    const raw = total > 0 ? (durations[i] / total) * 100 : 100 / visual.length;
    // Last chip absorbs accumulated rounding so the row always sums to 100.
    const widthPct = isLast ? Math.max(0, 100 - allocated) : Math.round(raw * 100) / 100;
    allocated += widthPct;

    return {
      editorIndex,
      kind: section.kind as TimelineKind,
      widthPct,
      ...(section.kind === 'color' ? { color: section.color } : {}),
      ...('transitionAfter' in section && section.transitionAfter ? { transitionAfter: section.transitionAfter } : {}),
    };
  });
}
