import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { holeOffsets } from './filmstrip-edge.logic';

export interface FilmstripEdgeProps {
  /** Centre-to-centre gap between sprocket holes (px). */
  holeSpacing?: number;
  /** Rail column width (px). */
  width?: number;
  className?: string;
}

// The vertical film spine that threads a card/column together: a hairline brand rail dotted with
// evenly-spaced sprocket perforations, so the surface reads as a strip of film / an edit timeline.
// Measures its own height (ResizeObserver) and lays the holes out from the pure logic. Decorative.
export function FilmstripEdge({ holeSpacing = 22, width = 14, className }: FilmstripEdgeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const el = ref.current;
    const observer = new ResizeObserver((entries) => {
      setHeight(entries[0]?.contentRect.height ?? 0);
    });

    if (el) observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, []);

  const offsets = useMemo(() => holeOffsets(height, holeSpacing, holeSpacing / 2), [height, holeSpacing]);

  return (
    <div ref={ref} aria-hidden="true" className={cn('relative', className)} style={{ width }}>
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-brand-500/25" />
      {offsets.map((y) => (
        <span
          key={y}
          className="absolute left-1/2 size-1.5 -translate-x-1/2 rounded-[2px] bg-brand-500/45"
          style={{ top: y - 3 }}
        />
      ))}
    </div>
  );
}

export default FilmstripEdge;
