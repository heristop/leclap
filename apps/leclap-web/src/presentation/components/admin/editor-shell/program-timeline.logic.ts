// Pure master-timeline math for the live program monitor: the visual scenes (video/color/image)
// concatenated into one playable timeline with per-boundary transition windows. The preview timeline
// is a straight concatenation — it deliberately ignores the xfade overlap that shortens the final
// render, keeping time→scene mapping monotone and the scrubber linear (documented preview-vs-render
// length difference).
import { DEFAULT_TRANSITION_DURATION } from 'ffmpeg-video-composer/src/schemas/effects.schemas.ts';
import type { DefaultTransition, EditorSection, MotionEffect, SectionTransition } from '../templateEditorModel';
import { previewFamilyFor, type PreviewFamily } from '../editor/transitionGroups';

export type VisualKind = 'video' | 'color' | 'image';

// A defensive floor for imported/odd durations (≤0 or non-finite) so one bad scene can't
// zero-collapse the timeline.
export const DEFAULT_SEGMENT_DURATION = 3;

export interface Segment {
  index: number; // index into the ORIGINAL sections array (for selection sync)
  kind: VisualKind;
  start: number; // master-clock seconds, inclusive
  end: number; // master-clock seconds, exclusive
  duration: number;
  transitionAfter?: SectionTransition;
}

export interface SceneClock {
  segment: Segment;
  index: number; // original section index
  localT: number; // seconds since this segment's start
  progress: number; // localT / duration, clamped 0..1
}

export interface ActiveTransition {
  fromIndex: number; // original section index of the outgoing scene
  toIndex: number; // original section index of the incoming scene
  family: PreviewFamily;
  progress: number; // 0..1 across the boundary blend window
}

const isVisual = (section: EditorSection): boolean =>
  section.kind === 'video' || section.kind === 'color' || section.kind === 'image';

const safeDuration = (duration: number): number =>
  Number.isFinite(duration) && duration > 0 ? duration : DEFAULT_SEGMENT_DURATION;

// The visual scenes concatenated into ordered segments. Non-visual scenes (music/form/partial)
// contribute nothing to the played timeline — they're authoring-only, matching how the engine joins
// visual sections. A boundary without its own transition inherits the template default (the engine's
// `section.transition ?? global.transition` rule); a cut default contributes nothing.
export function buildMasterTimeline(sections: EditorSection[], defaultTransition?: DefaultTransition): Segment[] {
  const segments: Segment[] = [];
  const fallback: SectionTransition | undefined =
    defaultTransition && defaultTransition.type !== 'cut' ? { ...defaultTransition } : undefined;
  let cursor = 0;

  for (const [index, section] of sections.entries()) {
    if (!isVisual(section)) continue;

    const visual = section as Extract<EditorSection, { kind: VisualKind }>;
    const duration = safeDuration(visual.duration);
    const transitionAfter = visual.transitionAfter ?? fallback;

    segments.push({
      index,
      kind: visual.kind,
      start: cursor,
      end: cursor + duration,
      duration,
      ...(transitionAfter ? { transitionAfter } : {}),
    });
    cursor += duration;
  }

  return segments;
}

export function totalDuration(timeline: Segment[]): number {
  return timeline.at(-1)?.end ?? 0;
}

// The scene under the playhead. Boundaries belong to the NEXT segment (t = end maps forward);
// past-the-end clamps to the last segment's final frame so pause-at-end holds a real picture.
export function sceneClockAt(timeline: Segment[], t: number): SceneClock | null {
  const last = timeline.at(-1);

  if (!last) return null;

  const clamped = Math.max(0, t);
  const segment = timeline.find((s) => clamped >= s.start && clamped < s.end) ?? last;
  const localT = Math.min(clamped - segment.start, segment.duration);

  return {
    segment,
    index: segment.index,
    localT,
    progress: Math.min(1, Math.max(0, localT / segment.duration)),
  };
}

// The blend window before a boundary: min(transition duration, half of each neighbour) so short
// scenes never blend past their midpoint. Entirely inside the outgoing segment — progress hits 1
// exactly when the coarse mount swaps to the incoming scene.
function blendWindow(segment: Segment, next: Segment): number {
  const wanted = segment.transitionAfter?.duration ?? DEFAULT_TRANSITION_DURATION;

  return Math.max(0.001, Math.min(wanted, segment.duration / 2, next.duration / 2));
}

const KENBURNS_DEFAULT_INTENSITY = 1.15;
const KENBURNS_PAN_PERCENT = 6;

// The backdrop transform for a scene's Ken Burns move at `progress` (0..1 through the scene).
// Zooms scale linearly between 1 and the intensity; pans hold the zoom and travel up to ±6% —
// the same character as the MotionPanel preview. Null when the scene has no kenburns motion.
export function kenburnsTransformAt(motion: MotionEffect[] | undefined, progress: number): string | null {
  const effect = motion?.find((m): m is Extract<MotionEffect, { type: 'kenburns' }> => m.type === 'kenburns');

  if (!effect) return null;

  const p = Math.min(1, Math.max(0, progress));
  const intensity = effect.intensity ?? KENBURNS_DEFAULT_INTENSITY;
  const direction = effect.direction ?? 'in';

  if (direction === 'in') return `scale(${(1 + (intensity - 1) * p).toFixed(4)})`;

  if (direction === 'out') return `scale(${(intensity - (intensity - 1) * p).toFixed(4)})`;

  const travel = (KENBURNS_PAN_PERCENT * p).toFixed(2);
  const pan: Record<'left' | 'right' | 'up' | 'down', string> = {
    left: `translate(${travel}%, 0)`,
    right: `translate(-${travel}%, 0)`,
    up: `translate(0, ${travel}%)`,
    down: `translate(0, -${travel}%)`,
  };

  return `scale(${intensity.toFixed(4)}) ${pan[direction]}`;
}

// Non-null only while the playhead sits inside an active xfade window: the current segment carries a
// real (non-cut) transition AND another visual segment follows.
export function transitionAt(timeline: Segment[], t: number): ActiveTransition | null {
  const clock = sceneClockAt(timeline, t);

  if (!clock) return null;

  const { segment } = clock;
  const type = segment.transitionAfter?.type;

  if (!type || type === 'cut') return null;

  const at = timeline.indexOf(segment);
  const next = timeline.at(at + 1);

  if (!next) return null;

  const window = blendWindow(segment, next);
  const startAt = segment.end - window;

  if (t < startAt || t >= segment.end) return null;

  return {
    fromIndex: segment.index,
    toIndex: next.index,
    family: previewFamilyFor(type),
    progress: Math.min(1, (t - startAt) / window),
  };
}
