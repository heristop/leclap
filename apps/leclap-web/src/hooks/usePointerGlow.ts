import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react';

const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Pointer-reactive "spotlight + magnetic tilt" for a surface. Tracks the cursor over the element and
 * writes CSS custom properties the styles read:
 *   --mx / --my      → pointer position (%), consumed by the `spotlight` utility's radial tint
 *   --tilt-x/--tilt-y → a few degrees of 3D lean (consumed by the `pointer-tilt` utility)
 *
 * Writing CSS vars (not React state) keeps this off the render path — pointermove never re-renders.
 * No-ops under prefers-reduced-motion, and resets on leave so the surface settles flat.
 */
export function usePointerGlow<T extends HTMLElement>(maxTiltDeg = 5) {
  const ref = useRef<T>(null);

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<T>) => {
      const el = ref.current;

      if (!el || reducedMotion()) {
        return;
      }

      const rect = el.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width; // 0..1 across
      const py = (event.clientY - rect.top) / rect.height; // 0..1 down

      el.style.setProperty('--mx', `${(px * 100).toFixed(2)}%`);
      el.style.setProperty('--my', `${(py * 100).toFixed(2)}%`);
      // Lean toward the cursor: top half tilts back (positive rotateX), right half tilts right.
      el.style.setProperty('--tilt-x', `${((0.5 - py) * 2 * maxTiltDeg).toFixed(2)}deg`);
      el.style.setProperty('--tilt-y', `${((px - 0.5) * 2 * maxTiltDeg).toFixed(2)}deg`);
    },
    [maxTiltDeg]
  );

  const onPointerLeave = useCallback(() => {
    const el = ref.current;

    if (!el) {
      return;
    }

    el.style.setProperty('--tilt-x', '0deg');
    el.style.setProperty('--tilt-y', '0deg');
  }, []);

  return { ref, glowProps: { onPointerMove, onPointerLeave } };
}
