// fx "mirror": one side of the target reflected across a seam, or both axes as a kaleidoscope
// (schemas/fx-surface.schemas.ts for the fields).
//
// A copy of the target region (a kit tap) is split: one copy is the canvas, the other is cropped to the kept
// strip next to the seam, flipped (hflip across a vertical seam, vflip across a horizontal one) and laid on
// the canvas on the far side of the seam. The strip is as wide as the kept side reaches, so an off-centre seam
// reflects only that far. quad runs the horizontal step and then the vertical step on its result. hstack and
// vstack are not in the device build, hence crop + flip + overlay. It holds for the window (it does not move,
// so reduced motion leaves it as is); skipped without hflip or vflip (on-device allowlist).

import type { Filter, FilterGraphChain } from '@/core/types';
import type { FxContext, FxEffect, FxLayer } from './fx-kit';
import { even, fromWindow } from './fx-light-kit';

type Axis = 'x' | 'y';

/** One reflection, in target px along its axis: the kept strip [strip, strip + reach) lands flipped at `place`. */
export interface Reflection {
  axis: Axis;
  seam: number;
  reach: number;
  strip: number;
  place: number;
}

/** The reflections the mirror makes, in order (quad: across x, then across y on the result). */
export function mirrorPlan(fx: FxContext<'mirror'>): Reflection[] {
  const { w, h } = fx.target;
  const mode = fx.graphic.mode ?? (w >= h ? 'horizontal' : 'vertical');
  const axes: Axis[] = mode === 'quad' ? ['x', 'y'] : [mode === 'horizontal' ? 'x' : 'y'];
  const fromEnd = fx.graphic.side === 'end';

  return axes.map((axis) => {
    const size = axis === 'x' ? w : h;
    const seam = Math.min(size - 2, even(size * (fx.graphic.seam ?? 0.5)));
    const reach = Math.min(seam, size - seam);

    // The kept strip touches the seam on the source side; its reflection lands on the other side.
    return { axis, seam, reach, strip: fromEnd ? seam : seam - reach, place: fromEnd ? seam - reach : seam };
  });
}

/** One reflection from `input` to `output` (pad names use the given letters), after the `lead` filters. */
function reflect(
  fx: FxContext<'mirror'>,
  step: Reflection,
  pads: { input: string; output: string; names: [string, string, string] },
  lead: Filter[]
): FilterGraphChain[] {
  const { w, h } = fx.target;
  const [canvas, source, flipped] = pads.names.map((name) => `${fx.prefix}${name}`);
  const horizontal = step.axis === 'x';
  const crop = horizontal ? `${step.reach}:${h}:${step.strip}:0` : `${w}:${step.reach}:0:${step.strip}`;
  const at = horizontal ? `x=${step.place}:y=0` : `x=0:y=${step.place}`;

  return [
    { inputs: [pads.input], filters: [...lead, { type: 'split', value: '2' }], outputs: [canvas, source] },
    {
      inputs: [source],
      filters: [
        { type: 'crop', value: crop },
        { type: horizontal ? 'hflip' : 'vflip', value: undefined },
      ],
      outputs: [flipped],
    },
    { inputs: [canvas, flipped], filters: [{ type: 'overlay', value: at }], outputs: [pads.output] },
  ];
}

const NAMES: Array<[string, string, string]> = [
  ['ma', 'mb', 'mf'],
  ['mc', 'md', 'mg'],
];

function lower(fx: FxContext<'mirror'>): FxLayer[] | null {
  const plan = mirrorPlan(fx);

  if (plan.some((step) => !fx.has(step.axis === 'x' ? 'hflip' : 'vflip'))) return null;

  const p = fx.prefix;
  const chains = plan.flatMap((step, i) => {
    const input = i === 0 ? `${p}tap` : `${p}m${i - 1}`;
    const output = i === plan.length - 1 ? `${p}mo` : `${p}m${i}`;

    // The first step trims the tap to the window (later steps read its output).
    return reflect(fx, step, { input, output, names: NAMES[i] }, i === 0 ? [fromWindow(fx)] : []);
  });

  return [{ chains, label: `${p}mo`, x: '0', y: '0', taps: [`${p}tap`] }];
}

export const MIRROR: FxEffect<'mirror'> = { lower };
