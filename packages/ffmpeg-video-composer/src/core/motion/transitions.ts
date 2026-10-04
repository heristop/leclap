// Designed transitions (docs/plans/motion-system-v2.md §4.3): eased, spring-capable boundaries.
//
// Instead of a per-pixel `xfade` expression (interpreted for every pixel of every frame: ~1 s per 720p
// frame), a designed boundary is cut into the outgoing tail and the incoming head, composed with filters
// whose geometry is evaluated once per frame (crop / overlay positions, zoompan), and concatenated back:
//
//   [left] → head ‖ tail ─┐
//                          ├─ compose(tail, in) → mix ─┐
//   [next] → in ‖ rest ────┘                           ├─ concat(head, mix, rest)
//
// Same timeline as xfade (offset + duration), so the audio crossfade and music windows are unchanged.
// Only standard filters (split, trim, setpts, pad, overlay, crop, scale, zoompan, xfade, concat), all in
// the on-device build.

import { parseEasing, type EasingSpec } from './easing';
import { easedProgressExpr, fmt } from './hermite';

export const DESIGNED_TRANSITIONS = [
  'push-left',
  'push-right',
  'push-up',
  'push-down',
  'swipe-left',
  'swipe-right',
  'zoom-through',
  'iris',
] as const;

export type DesignedTransition = (typeof DESIGNED_TRANSITIONS)[number];

export const DESIGNED_TRANSITION_DESCRIPTIONS: Record<DesignedTransition, string> = {
  'push-left': 'The next scene pushes the current one out to the left, both moving together.',
  'push-right': 'The next scene pushes the current one out to the right.',
  'push-up': 'The next scene pushes the current one up and out.',
  'push-down': 'The next scene pushes the current one down and out.',
  'swipe-left': 'The next scene slides over from the right while the current one drifts left beneath it.',
  'swipe-right': 'The next scene slides over from the left while the current one drifts right beneath it.',
  'zoom-through': 'The camera flies through the current scene into the next: scale up, cross, settle.',
  iris: 'A circle opens from the centre to reveal the next scene (linear; ease is ignored).',
};

/** Default transition curve: a symmetric, Apple-like ease-in-out. */
export const DEFAULT_TRANSITION_EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';

export function isDesignedTransition(type: string): type is DesignedTransition {
  return (DESIGNED_TRANSITIONS as readonly string[]).includes(type);
}

export interface DesignedBoundary {
  type: DesignedTransition;
  ease?: EasingSpec;
  /** Graph labels, without brackets. */
  left: string;
  right: string;
  out: string;
  /** Unique prefix for intermediate labels. */
  id: string;
  offset: number;
  duration: number;
  width: number;
  height: number;
  fps: number;
}

interface Pads {
  tail: string;
  in: string;
  mix: string;
}

function push(b: DesignedBoundary, p: Pads, e: string): string {
  const { width: w, height: h } = b;
  const table = {
    'push-left': [`pad=${2 * w}:${h}:0:0`, `x=${w}:y=0`, `x='${w}*(${e})':y=0`],
    'push-right': [`pad=${2 * w}:${h}:${w}:0`, 'x=0:y=0', `x='${w}*(1-(${e}))':y=0`],
    'push-up': [`pad=${w}:${2 * h}:0:0`, `x=0:y=${h}`, `x=0:y='${h}*(${e})'`],
    'push-down': [`pad=${w}:${2 * h}:0:${h}`, 'x=0:y=0', `x=0:y='${h}*(1-(${e}))'`],
  } as const;
  const [pad, place, crop] = table[b.type as keyof typeof table];

  return `[${p.tail}]${pad}[${b.id}p];[${b.id}p][${p.in}]overlay=${place}[${b.id}s];[${b.id}s]crop=${w}:${h}:${crop}[${p.mix}]`;
}

function swipe(b: DesignedBoundary, p: Pads, e: string): string {
  const { width: w, height: h } = b;
  const drift = Math.round(w * 0.3);

  if (b.type === 'swipe-left') {
    return (
      `[${p.tail}]pad=${w + drift}:${h}:0:0,crop=${w}:${h}:x='${drift}*(${e})':y=0[${b.id}a];` +
      `[${b.id}a][${p.in}]overlay=x='${w}*(1-(${e}))':y=0[${p.mix}]`
    );
  }

  return (
    `[${p.tail}]pad=${w + drift}:${h}:${drift}:0,crop=${w}:${h}:x='${drift}*(1-(${e}))':y=0[${b.id}a];` +
    `[${b.id}a][${p.in}]overlay=x='-${w}*(1-(${e}))':y=0[${p.mix}]`
  );
}

function zoomChain(z: string, b: DesignedBoundary): string {
  const { width: w, height: h, fps } = b;

  return `scale=${2 * w}:${2 * h},zoompan=z='${z}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=${w}x${h}:fps=${fps},settb=AVTB`;
}

function zoomThrough(b: DesignedBoundary, p: Pads): string {
  const ease = parseEasing(b.ease ?? DEFAULT_TRANSITION_EASE);
  const e = easedProgressExpr(ease, { delay: 0, duration: b.duration }, `(on/${b.fps})`);

  return (
    `[${p.tail}]${zoomChain(`1+0.6*(${e})`, b)}[${b.id}za];[${p.in}]${zoomChain(`1.25-0.25*(${e})`, b)}[${b.id}zb];` +
    `[${b.id}za][${b.id}zb]xfade=transition=fade:duration=${fmt(b.duration)}:offset=0[${p.mix}]`
  );
}

// The built-in circle reveal: a per-pixel soft edge cost ~0.8 s per 720p frame, too slow for a phone.
function iris(b: DesignedBoundary, p: Pads): string {
  return `[${p.tail}][${p.in}]xfade=transition=circleopen:duration=${fmt(b.duration)}:offset=0[${p.mix}]`;
}

function compose(b: DesignedBoundary, p: Pads): string {
  if (b.type === 'zoom-through') return zoomThrough(b, p);

  if (b.type === 'iris') return iris(b, p);

  const e = easedProgressExpr(parseEasing(b.ease ?? DEFAULT_TRANSITION_EASE), { delay: 0, duration: b.duration });

  return b.type.startsWith('push') ? push(b, p, e) : swipe(b, p, e);
}

/** The filtergraph fragment for one designed boundary: [left] + [right] → [out]. */
export function designedTransitionGraph(b: DesignedBoundary): string {
  const id = b.id;
  const [off, end, d] = [fmt(b.offset), fmt(b.offset + b.duration), fmt(b.duration)];
  const pads: Pads = { tail: `${id}tail`, in: `${id}in`, mix: `${id}mix` };

  return [
    `[${b.left}]split=2[${id}l1][${id}l2]`,
    `[${b.right}]split=2[${id}r1][${id}r2]`,
    `[${id}l1]trim=end=${off},setpts=PTS-STARTPTS[${id}head]`,
    `[${id}l2]trim=start=${off}:end=${end},setpts=PTS-STARTPTS[${pads.tail}]`,
    `[${id}r1]trim=end=${d},setpts=PTS-STARTPTS[${pads.in}]`,
    `[${id}r2]trim=start=${d},setpts=PTS-STARTPTS[${id}rest]`,
    compose(b, pads),
    // One timebase everywhere (xfade refuses mixed ones; concat and zoompan each pick their own).
    `[${id}head][${pads.mix}][${id}rest]concat=n=3:v=1:a=0,settb=AVTB[${b.out}]`,
  ].join(';');
}
