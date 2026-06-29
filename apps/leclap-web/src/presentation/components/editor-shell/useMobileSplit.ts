import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

// Remembers the mobile monitor/panel split (the draggable divider between the preview and the controls
// panel in the stacked mobile layout). Desktop ignores it — the divider is hidden and `lg:h-auto`
// resets the height, so the grid lays out as usual.
const STORAGE_KEY = 'leclap.studio.splitPx';
const MIN_MONITOR = 160; // px — the preview never collapses below this
const MIN_REST = 240; // px — keep room for the panel + timeline + dock below the divider
const DEFAULT_VH = 38; // initial monitor height before the user drags — leaves more room for the panel below

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
// var; `beginResize` is the divider's onPointerDown. Height is measured from the container top, so it
// equals the monitor's height (the monitor is the top-most region in the mobile stack).
export const useMobileSplit = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [heightPx, setHeightPx] = useState<number | null>(readStored);

  const monitorHeight = heightPx === null ? `${DEFAULT_VH}vh` : `${heightPx}px`;

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

  useEffect(() => {
    if (heightPx === null) return;

    try {
      localStorage.setItem(STORAGE_KEY, String(heightPx));
    } catch {
      // Storage can throw in private mode — the split just won't persist.
    }
  }, [heightPx]);

  return { containerRef, monitorHeight, beginResize };
};
