// Maps between the 8-arrow sweep picker and the descriptor's two gradient direction fields:
// the legacy `direction` enum (horizontal/vertical/diagonal — kept as sugar so old descriptors
// stay byte-identical) and the free `angle` in degrees (CSS convention: 0 = bottom→top,
// 90 = left→right, clockwise) that unlocks the reverse and diagonal sweeps the enum lacks.
import type { BackgroundLayer } from '../templateEditorModel';

type Gradient = NonNullable<BackgroundLayer['gradient']>;
type Direction = NonNullable<Gradient['direction']>;

// The engine lowers each enum member to this CSS-convention angle (inputSources.ts sweeps).
const DIRECTION_TO_ANGLE: Record<Direction, number> = {
  horizontal: 90,
  vertical: 180,
  diagonal: 135,
};

const ANGLE_TO_DIRECTION = new Map<number, Direction>(
  Object.entries(DIRECTION_TO_ANGLE).map(([direction, angle]) => [angle, direction as Direction])
);

const normalize = (angle: number): number => ((angle % 360) + 360) % 360;

// The sweep angle a gradient currently renders with: the free angle wins (like the engine),
// then the enum's fixed angle, then the engine's vertical (top→bottom) default.
export function sweepToAngle(gradient: Gradient): number {
  if (gradient.angle !== undefined) return normalize(gradient.angle);

  return DIRECTION_TO_ANGLE[gradient.direction ?? 'vertical'];
}

// Applies a picked sweep angle: angles the enum can express are emitted AS the enum (and the
// free field dropped) so descriptors stay backward compatible; the rest emit the free angle.
export function applySweepAngle(gradient: Gradient, angleDeg: number): Gradient {
  const rest: Gradient = { ...gradient };

  delete rest.direction;
  delete rest.angle;

  const normalized = normalize(angleDeg);
  const direction = ANGLE_TO_DIRECTION.get(normalized);

  if (direction) return { ...rest, direction };

  return { ...rest, angle: normalized };
}
