// Descriptor rules for the motion system (docs/plans/motion-system-v2.md §2–3):
//
// - invalid_motion_token / unknown_motion_token / invalid_easing: token definitions and references.
// - invalid_keyframes: key times out of order, a relative value on a non-positional track, a scale track
//   without a numeric fontsize, or tracks on something other than a drawtext.

import type { TemplateDescriptor } from '../schemas/template.schemas';
import { EasingError, easingError, validSpring, type EasingSpec } from '@/core/motion/easing';
import { resolveEasingRef, resolveTimeRef, resolveTokens, type ResolvedTokens } from '@/core/motion/tokens';
import { keyTimesError, type TrackKey } from '@/core/motion/tracks';
import { FONT_ADVANCES } from '@/core/font-advances.generated';
import { findFont } from '@/core/fonts';
import { KINETIC_PRESET_DEFAULTS } from '@/core/kinetic/presets';
import { parseTimeRef } from '@/core/timing/grammar';
import { resolveTimeRefs } from '@/core/timing/resolve';

// Structurally the validator's ValidationError (declared here so the rules module can import this one
// without a cycle).
interface ValidationError {
  path: string;
  message: string;
  code: string;
}

interface Use {
  path: string;
  kind: 'easing' | 'animate';
  value: unknown;
  owner: Record<string, unknown>;
}

function collect(value: unknown, path: string, uses: Use[]): void {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) collect(item, `${path}[${index}]`, uses);

    return;
  }

  if (value === null || typeof value !== 'object') return;

  const record = value as Record<string, unknown>;

  for (const [key, child] of Object.entries(record)) {
    const childPath = `${path}.${key}`;

    if (key === 'easing' || key === 'ease') uses.push({ path: childPath, kind: 'easing', value: child, owner: record });

    if (key === 'animate') uses.push({ path: childPath, kind: 'animate', value: child, owner: record });

    if (key !== 'motion' || path !== 'global') collect(child, childPath, uses);
  }
}

function motionUses(template: TemplateDescriptor): Use[] {
  const uses: Use[] = [];
  collect(template.global, 'global', uses);
  collect(template.sections, 'sections', uses);

  return uses;
}

type MotionTokensInput = NonNullable<TemplateDescriptor['global']>['motion'];

function springTokenErrors(motion: MotionTokensInput): ValidationError[] {
  return Object.entries(motion?.springs ?? {}).flatMap(([name, spring]) => {
    const path = `global.motion.springs.${name}`;
    const clash = motion?.curves && Object.hasOwn(motion.curves, name);
    const errors: ValidationError[] = clash
      ? [{ path, message: `"${name}" is both a spring and a curve`, code: 'invalid_motion_token' }]
      : [];

    try {
      validSpring(spring);
    } catch (error) {
      if (!(error instanceof EasingError)) throw error;

      errors.push({ path, message: error.message, code: 'invalid_motion_token' });
    }

    return errors;
  });
}

function curveTokenErrors(motion: MotionTokensInput): ValidationError[] {
  return Object.entries(motion?.curves ?? {}).flatMap(([name, curve]) => {
    const message =
      typeof curve === 'string' && curve.startsWith('$') ? 'curve tokens cannot reference tokens' : easingError(curve);

    return message ? [{ path: `global.motion.curves.${name}`, message, code: 'invalid_motion_token' }] : [];
  });
}

function easingUseError(use: Use, tokens: ResolvedTokens): ValidationError | null {
  const spec = use.value as EasingSpec;
  const resolved = resolveEasingRef(spec, tokens);

  if (typeof resolved === 'string' && resolved.startsWith('$')) {
    return { path: use.path, message: `unknown motion token "${resolved}"`, code: 'unknown_motion_token' };
  }

  const message = easingError(resolved);

  return message ? { path: use.path, message, code: 'invalid_easing' } : null;
}

function trackError(
  axis: string,
  keys: TrackKey[],
  owner: Record<string, unknown>,
  tokens: ResolvedTokens
): string | null {
  const resolved = keys.map((key) => ({ ...key, t: resolveTimeRef(key.t, tokens) }));

  // A time reference left unresolved is reported by the time-reference rules.
  if (resolved.some((key) => typeof key.t === 'string' && parseTimeRef(key.t))) return null;

  const badTime = resolved.find((key) => typeof key.t === 'string' && !/^\+?\d+(?:\.\d+)?$/.test(key.t));

  if (badTime) return `time "${String(badTime.t)}" is not seconds, "+seconds", a duration token or a time reference`;

  if ((axis === 'opacity' || axis === 'scale') && keys.some((key) => typeof key.v === 'string')) {
    return `${axis} keys take plain numbers, not relative offsets`;
  }

  if (axis === 'scale' && typeof (owner.values as Record<string, unknown> | undefined)?.fontsize !== 'number') {
    return 'a scale track needs a numeric values.fontsize to scale';
  }

  return keyTimesError(resolved.map((key) => ({ ...key, ease: resolveEasingRef(key.ease ?? 'linear', tokens) })));
}

function animateUseErrors(use: Use, tokens: ResolvedTokens): ValidationError[] {
  if (use.owner.type !== 'drawtext') {
    return [{ path: use.path, message: 'animate tracks apply to drawtext filters', code: 'invalid_keyframes' }];
  }

  return Object.entries(use.value as Record<string, TrackKey[]>).flatMap(([axis, keys]) => {
    const message = trackError(axis, keys, use.owner, tokens);

    return message ? [{ path: `${use.path}.${axis}`, message, code: 'invalid_keyframes' }] : [];
  });
}

type KineticInput = NonNullable<
  Extract<NonNullable<TemplateDescriptor['sections']>[number], { kinetic?: unknown }>['kinetic']
>[number];

// Word/glyph layout needs the advance table of a bundled font; counter needs its numbers.
function kineticBlockErrors(block: KineticInput, path: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const unit = block.unit ?? KINETIC_PRESET_DEFAULTS[block.preset].unit;
  const file = block.font ? (findFont(block.font)?.file ?? block.font) : 'BebasNeue.ttf';

  if (block.preset !== 'counter' && unit !== 'line' && !Object.hasOwn(FONT_ADVANCES, file)) {
    errors.push({
      path: `${path}.font`,
      message: `"${block.font}" is not a bundled font, so ${unit}s can't be laid out; use a bundled font id or unit "line"`,
      code: 'kinetic_font_unmeasurable',
    });
  }

  if (block.preset === 'counter' && !block.counter) {
    errors.push({
      path: `${path}.counter`,
      message: 'the counter preset needs counter.from and counter.to',
      code: 'invalid_kinetic',
    });
  }

  return errors;
}

function kineticErrors(template: TemplateDescriptor): ValidationError[] {
  return (template.sections ?? []).flatMap((section, index) =>
    'kinetic' in section && section.kinetic
      ? section.kinetic.flatMap((block, k) => kineticBlockErrors(block, `sections[${index}].kinetic[${k}]`))
      : []
  );
}

export function validateMotionSystem(template: TemplateDescriptor): ValidationError[] {
  // Keyframe times may be time references: check the tracks as they will lower, in seconds.
  const uses = motionUses(resolveTimeRefs(template).descriptor);

  const tokens = resolveTokens(template.global?.motion);
  const easingErrors = uses.filter((use) => use.kind === 'easing').map((use) => easingUseError(use, tokens));
  // Tracks are only checked once their eases parse, so a bad ease is reported once, as invalid_easing.
  const tracks = easingErrors.some(Boolean) ? [] : uses.filter((use) => use.kind === 'animate');

  return [
    ...springTokenErrors(template.global?.motion),
    ...curveTokenErrors(template.global?.motion),
    ...easingErrors.filter((error): error is ValidationError => error !== null),
    ...tracks.flatMap((use) => animateUseErrors(use, tokens)),
    ...kineticErrors(template),
  ];
}
