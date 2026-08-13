import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

// Remembers the mobile monitor/panel split (the draggable divider between the preview and the controls
// panel in the stacked mobile layout). Desktop ignores it — the divider is hidden and `lg:h-auto`
// resets the height, so the grid lays out as usual.
const STORAGE_KEY = 'leclap.studio.splitPx';
const MIN_MONITOR = 140; // px — the preview never collapses below this
// px — room the regions below the divider need: the panel's own header + a usable slice of its body,
// plus the scene lane and the dock. Sized so the capture controls (drop zone AND the record button)
// clear the fold on a small phone instead of the panel being cropped to a sliver.
const MIN_REST = 340;
// Initial monitor height before the user drags. `dvh` (not `vh`) so mobile browser chrome collapsing
// doesn't leave the split measured against a viewport taller than the one actually on screen.
const DEFAULT_VH = 30;

const readStored = (): number | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const value = raw === null ? Number.NaN : Number(raw);

    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
};

// `containerRef` goes on the stacked shell body; `monitorHeight` feeds the monitor's `--monitor-h`
// var; `beginResize` is the divider's onPointerDown; `resizeBy` nudges the split by a signed pixel
// delta (the divider's keyboard path). Height is measured from the container top, so it equals the
// monitor's height (the monitor is the top-most region in the mobile stack).
export const useMobileSplit = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [heightPx, setHeightPx] = useState<number | null>(readStored);

  const monitorHeight = heightPx === null ? `${DEFAULT_VH}dvh` : `${heightPx}px`;

  const clampForContainer = useCallback((raw: number, total: number): number => {
    const max = Math.max(MIN_MONITOR, total - MIN_REST);

    return Math.min(max, Math.max(MIN_MONITOR, raw));
  }, []);

  const beginResize = useCallback(
    (e: ReactPointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();

      if (!rect) return;

      e.preventDefault();

      const onMove = (ev: PointerEvent) => {
        setHeightPx(clampForContainer(ev.clientY - rect.top, rect.height));
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [clampForContainer]
  );

  const resizeBy = useCallback(
    (delta: number) => {
      const rect = containerRef.current?.getBoundingClientRect();

      if (!rect) return;

      setHeightPx((current) => {
        const base = current ?? (rect.height * DEFAULT_VH) / 100;

        return clampForContainer(base + delta, rect.height);
      });
    },
    [clampForContainer]
  );

  // Re-clamp a restored split against the live container on mount: the stored value may come from a
  // taller device or a build with a smaller `MIN_REST`, and the drag handler is the only other place
  // the clamp runs.
  useEffect(() => {
    const rect = containerRef.current?.getBoundingClientRect();

    if (!rect || rect.height === 0) return;

    setHeightPx((current) => (current === null ? null : clampForContainer(current, rect.height)));
  }, [clampForContainer]);

  useEffect(() => {
    if (heightPx === null) return;

    try {
      localStorage.setItem(STORAGE_KEY, String(heightPx));
    } catch {
      // Storage can throw in private mode — the split just won't persist.
    }
  }, [heightPx]);

  return { containerRef, monitorHeight, beginResize, resizeBy };
};
