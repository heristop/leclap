import { useRef, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import clsx from 'clsx';
import type { TextOverlay } from './templateEditorModel';

interface TextPositionerProps {
  overlays: TextOverlay[];
  orientation: 'landscape' | 'portrait';
  activeIndex: number;
  onSelect: (index: number) => void;
  onMove: (index: number, x: number, y: number) => void;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

// 2% keyboard nudge step.
const STEP = 0.02;

// Arrow-key → [dx, dy] fraction offsets. Partial so an unmapped key reads `undefined`.
const KEY_OFFSETS: Partial<Record<string, [number, number]>> = {
  ArrowLeft: [-STEP, 0],
  ArrowRight: [STEP, 0],
  ArrowUp: [0, -STEP],
  ArrowDown: [0, STEP],
};

// Map a pointer position to a [0,1] fraction within the frame box.
function fractionFromPointer(box: DOMRect, clientX: number, clientY: number): { x: number; y: number } {
  const x = box.width === 0 ? 0.5 : (clientX - box.left) / box.width;
  const y = box.height === 0 ? 0.5 : (clientY - box.top) / box.height;

  return { x: clamp01(x), y: clamp01(y) };
}

interface ChipProps {
  overlay: TextOverlay;
  index: number;
  active: boolean;
  onSelect: (index: number) => void;
  onDrag: (index: number, clientX: number, clientY: number) => void;
  onNudge: (index: number, dx: number, dy: number) => void;
}

// One draggable chip representing a single overlay, positioned by its [0,1]
// fractions and tinted with the overlay's own font/box colors.
const PositionerChip = ({ overlay, index, active, onSelect, onDrag, onNudge }: ChipProps) => {
  const label = overlay.text.trim() === '' ? `Text ${index + 1}` : overlay.text;

  const handlePointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    // Select this chip and start dragging — never arm the section card's grip-drag.
    e.stopPropagation();
    e.preventDefault();
    onSelect(index);
    e.currentTarget.setPointerCapture(e.pointerId);
    onDrag(index, e.clientX, e.clientY);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    e.stopPropagation();
    onDrag(index, e.clientX, e.clientY);
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    const offset = KEY_OFFSETS[e.key];

    if (offset === undefined) return;
    e.preventDefault();
    e.stopPropagation();
    onNudge(index, offset[0], offset[1]);
  };

  return (
    <button
      type="button"
      aria-label={`Drag to position "${label}"`}
      aria-pressed={active}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      style={{
        left: `${overlay.x * 100}%`,
        top: `${overlay.y * 100}%`,
        transform: 'translate(-50%, -50%)',
        color: overlay.fontcolor,
        backgroundColor: overlay.box ? overlay.boxcolor : 'rgba(0,0,0,0.55)',
        zIndex: active ? 2 : 1,
      }}
      className={clsx(
        'absolute max-w-[90%] cursor-grab touch-none select-none truncate rounded-md px-2 py-1 text-xs font-semibold shadow-md backdrop-blur-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 active:cursor-grabbing',
        active ? 'ring-2 ring-brand-500 ring-offset-1 ring-offset-black/30' : 'opacity-80 ring-1 ring-white/20'
      )}
    >
      {label}
    </button>
  );
};

// A small video-frame preview showing every overlay as a draggable chip.
// Positions are reported back as [0,1] fractions of the frame.
export const TextPositioner = ({ overlays, orientation, activeIndex, onSelect, onMove }: TextPositionerProps) => {
  const frameRef = useRef<HTMLDivElement>(null);

  const moveAt = (index: number, clientX: number, clientY: number) => {
    const box = frameRef.current?.getBoundingClientRect();

    if (!box) return;
    const next = fractionFromPointer(box, clientX, clientY);
    onMove(index, next.x, next.y);
  };

  const nudgeAt = (index: number, dx: number, dy: number) => {
    // `index` is always a rendered chip's index, so the overlay is present.
    const overlay = overlays[index];
    onMove(index, clamp01(overlay.x + dx), clamp01(overlay.y + dy));
  };

  return (
    <div className="sm:col-span-2">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">Text position</span>
      <div
        ref={frameRef}
        className={clsx(
          'relative w-full overflow-hidden rounded-lg border border-foreground/10 bg-surface-2',
          'bg-[linear-gradient(135deg,var(--color-surface-2),var(--color-surface))]',
          orientation === 'portrait' ? 'mx-auto aspect-[9/16] max-w-[12rem]' : 'aspect-video'
        )}
      >
        {/* faint center crosshair as a reference grid */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-foreground/10" />
        <div className="pointer-events-none absolute inset-y-0 left-1/2 border-l border-dashed border-foreground/10" />
        {overlays.length === 0 && (
          <p className="pointer-events-none absolute inset-0 grid place-items-center px-4 text-center text-xs text-gray-500 dark:text-gray-400">
            Add a text overlay to position it here.
          </p>
        )}
        {overlays.map((overlay, index) => (
          <PositionerChip
            key={index}
            overlay={overlay}
            index={index}
            active={index === activeIndex}
            onSelect={onSelect}
            onDrag={moveAt}
            onNudge={nudgeAt}
          />
        ))}
      </div>
      {overlays.length > 0 && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Drag a text, or focus it and use the arrow keys to nudge.
        </p>
      )}
    </div>
  );
};
