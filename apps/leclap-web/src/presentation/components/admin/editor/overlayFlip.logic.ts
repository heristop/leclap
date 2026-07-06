// Pure mirror-toggle logic for the overlay flip control (placementFields). The descriptor stores one
// combined value ('horizontal' | 'vertical' | 'both' | absent) while the UI exposes two independent
// axis toggles, so these helpers translate between the two shapes.
import type { OverlayFlip } from '../templateEditorModel';

export type FlipAxis = 'horizontal' | 'vertical';

/** Whether the given axis is active inside the combined flip value. */
export function hasFlipAxis(flip: OverlayFlip | undefined, axis: FlipAxis): boolean {
  return flip === axis || flip === 'both';
}

/**
 * CSS transform fragment approximating the engine's mirror for the canvas previews ('' = unflipped).
 * Composed BEFORE rotate in source order reversed — CSS applies right-to-left, so callers append this
 * after their `rotate(…)` fragment to match the engine's flip-then-rotate chain.
 */
export function flipCssTransform(flip: OverlayFlip | undefined): string {
  if (!flip) return '';

  if (flip === 'horizontal') return 'scaleX(-1)';

  if (flip === 'vertical') return 'scaleY(-1)';

  return 'scale(-1, -1)';
}

/** Toggle one axis on/off, recombining into the single stored value (undefined = unmirrored). */
export function toggleFlipAxis(flip: OverlayFlip | undefined, axis: FlipAxis): OverlayFlip | undefined {
  const horizontal = hasFlipAxis(flip, 'horizontal') !== (axis === 'horizontal');
  const vertical = hasFlipAxis(flip, 'vertical') !== (axis === 'vertical');

  if (horizontal && vertical) return 'both';

  if (horizontal) return 'horizontal';

  if (vertical) return 'vertical';

  return undefined;
}
