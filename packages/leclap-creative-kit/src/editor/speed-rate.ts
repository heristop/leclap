// Conversions between the user-facing playback rate (×, bigger = faster) and the descriptor's
// options.speed — which the engine consumes as a PTS multiplier (bigger = SLOWER): rate = 1/speed.
// The slider moves over a fixed set of friendly stops so authored descriptors carry clean values.

export const RATE_STOPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const;

export const NORMAL_RATE_INDEX = RATE_STOPS.indexOf(1);

// The user-facing rate for a stored descriptor speed (PTS multiplier). Unset means normal (1×).
export function rateFromSpeed(speed: number | undefined): number {
  if (speed === undefined || speed <= 0) return 1;

  return 1 / speed;
}

// The descriptor speed (PTS multiplier) for a user-facing rate; normal rate maps to unset.
export function speedFromRate(rate: number): number | undefined {
  if (rate === 1 || rate <= 0) return undefined;

  return 1 / rate;
}

// The RATE_STOPS index nearest to an arbitrary rate — positions the slider for imported descriptors
// whose speed doesn't land exactly on a stop.
export function nearestRateIndex(rate: number): number {
  let best = 0;

  for (let i = 1; i < RATE_STOPS.length; i += 1) {
    if (Math.abs(RATE_STOPS[i] - rate) < Math.abs(RATE_STOPS[best] - rate)) best = i;
  }

  return best;
}

// Compact display label: trims trailing zeros ("0.75×", "2×").
export function formatRate(rate: number): string {
  return `${Number(rate.toFixed(2))}×`;
}
