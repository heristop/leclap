import { useRef } from 'react';
import type { VideoCrop } from '@/domain/valueObjects/videoEdits';

/** Displayed-video rect inside the editor container, in CSS pixels. */
export interface VideoRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

type Corner = 'tl' | 'tr' | 'bl' | 'br';

const MIN_SIZE = 0.12; // smallest crop is 12% of the frame
const CORNERS: Corner[] = ['tl', 'tr', 'bl', 'br'];

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/**
 * Compute a new normalized crop when dragging a corner by (dnx, dny) normalized deltas.
 * The opposite corner stays anchored; min size is enforced.
 */
function resizeByCorner(start: VideoCrop, corner: Corner, dnx: number, dny: number): VideoCrop {
  const right = start.x + start.w;
  const bottom = start.y + start.h;

  if (corner === 'tl') {
    const x = clamp(start.x + dnx, 0, right - MIN_SIZE);
    const y = clamp(start.y + dny, 0, bottom - MIN_SIZE);

    return { x, y, w: right - x, h: bottom - y };
  }

  if (corner === 'tr') {
    const y = clamp(start.y + dny, 0, bottom - MIN_SIZE);

    return { x: start.x, y, w: clamp(start.w + dnx, MIN_SIZE, 1 - start.x), h: bottom - y };
  }

  if (corner === 'bl') {
    const x = clamp(start.x + dnx, 0, right - MIN_SIZE);

    return { x, y: start.y, w: right - x, h: clamp(start.h + dny, MIN_SIZE, 1 - start.y) };
  }

  return { x: start.x, y: start.y, w: clamp(start.w + dnx, MIN_SIZE, 1 - start.x), h: clamp(start.h + dny, MIN_SIZE, 1 - start.y) };
}

/**
 * Draggable + resizable crop frame rendered over the displayed video. Reports the crop
 * normalized to the source frame (0..1) so it is resolution-independent.
 */
export function CropFrame({
  videoRect,
  crop,
  onChange,
}: {
  videoRect: VideoRect;
  crop: VideoCrop;
  onChange: (next: VideoCrop) => void;
}) {
  const cropRef = useRef<VideoCrop>(crop);
  cropRef.current = crop;

  const startDrag = (kind: 'move' | Corner) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const startCrop = cropRef.current;
    const startX = e.clientX;
    const startY = e.clientY;

    const onMove = (ev: PointerEvent) => {
      const dnx = (ev.clientX - startX) / videoRect.width;
      const dny = (ev.clientY - startY) / videoRect.height;

      if (kind === 'move') {
        onChange({
          ...startCrop,
          x: clamp(startCrop.x + dnx, 0, 1 - startCrop.w),
          y: clamp(startCrop.y + dny, 0, 1 - startCrop.h),
        });

        return;
      }

      onChange(resizeByCorner(startCrop, kind, dnx, dny));
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Pixel rect of the crop frame within the container.
  const rect = {
    left: videoRect.left + crop.x * videoRect.width,
    top: videoRect.top + crop.y * videoRect.height,
    width: crop.w * videoRect.width,
    height: crop.h * videoRect.height,
  };

  const cornerPos = (corner: Corner) => ({
    left: corner === 'tl' || corner === 'bl' ? rect.left : rect.left + rect.width,
    top: corner === 'tl' || corner === 'tr' ? rect.top : rect.top + rect.height,
  });

  return (
    <div className="absolute inset-0 touch-none">
      {/* Dim mask around the crop region (four bands). */}
      <div className="absolute bg-black/55" style={{ left: videoRect.left, top: videoRect.top, width: videoRect.width, height: rect.top - videoRect.top }} />
      <div className="absolute bg-black/55" style={{ left: videoRect.left, top: rect.top + rect.height, width: videoRect.width, height: videoRect.top + videoRect.height - (rect.top + rect.height) }} />
      <div className="absolute bg-black/55" style={{ left: videoRect.left, top: rect.top, width: rect.left - videoRect.left, height: rect.height }} />
      <div className="absolute bg-black/55" style={{ left: rect.left + rect.width, top: rect.top, width: videoRect.left + videoRect.width - (rect.left + rect.width), height: rect.height }} />

      {/* Draggable crop frame body. */}
      <div
        onPointerDown={startDrag('move')}
        className="absolute border-2 border-white cursor-move"
        style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
      >
        {/* rule-of-thirds guides */}
        <div className="absolute inset-y-0 w-px bg-foreground/40" style={{ left: '33.33%' }} />
        <div className="absolute inset-y-0 w-px bg-foreground/40" style={{ left: '66.66%' }} />
        <div className="absolute inset-x-0 h-px bg-foreground/40" style={{ top: '33.33%' }} />
        <div className="absolute inset-x-0 h-px bg-foreground/40" style={{ top: '66.66%' }} />
      </div>

      {/* corner handles */}
      {CORNERS.map((corner) => {
        const pos = cornerPos(corner);
        const cursor = corner === 'tl' || corner === 'br' ? 'cursor-nwse-resize' : 'cursor-nesw-resize';

        return (
          <div
            key={corner}
            onPointerDown={startDrag(corner)}
            className={`absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full bg-white border-2 border-brand-500 shadow ${cursor}`}
            style={{ left: pos.left, top: pos.top }}
          />
        );
      })}
    </div>
  );
}

export default CropFrame;
