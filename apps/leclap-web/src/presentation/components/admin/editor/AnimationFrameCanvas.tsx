// Direct-manipulation placement for an animation overlay: a scaled stand-in of the output frame with
// the .apng as a draggable, resizable box. Dragging writes position ("x:y" output px), the corner
// handle writes scale ("w:h" output px), and arrow keys nudge the position for keyboard users. An
// unset overlay shows at the file's native size at the top-left — exactly how the engine composites it.
import { useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Orientation } from '../templateEditorModel';
import {
  FRAME_SIZE,
  PREVIEW_BG_CLASS,
  clamp,
  parsePair,
  toNum,
  isAnimationVideo,
  type PreviewBg,
} from './animationOverlay';

const DISPLAY_MAX = 168; // px — the frame's larger side on screen
const MIN_SIZE = 16; // output px — smallest the overlay can be resized to

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Resolve the scale sides, honouring a "-1" aspect side and falling back to the native size when a side
// is unset. Returns the (possibly still-undefined) w/h for the rect builder to floor at 1.
function resolveScale(
  scale: string | undefined,
  nat: { w: number; h: number }
): { w: number | undefined; h: number | undefined } {
  const [rawW, rawH] = parsePair(scale);
  const w = toNum(rawW);
  const h = toNum(rawH);

  if (w === undefined && h === undefined) return { w: nat.w, h: nat.h };

  if (w !== undefined && (h === undefined || h === -1)) {
    return { w, h: Math.round((w * nat.h) / nat.w) };
  }

  if (h !== undefined && (w === undefined || w === -1)) {
    return { w: Math.round((h * nat.w) / nat.h), h };
  }

  return { w, h };
}

// Resolve the overlay's output-px rect from the stored position/scale, falling back to the image's
// native size (and honouring a "-1" aspect side in scale).
function resolveRect(
  position: string | undefined,
  scale: string | undefined,
  natural: { w: number; h: number } | null,
  frame: { w: number; h: number }
): Rect {
  const nat = natural ?? frame;
  const { w, h } = resolveScale(scale, nat);
  const [rawX, rawY] = parsePair(position);

  return { x: toNum(rawX) ?? 0, y: toNum(rawY) ?? 0, w: Math.max(1, w ?? nat.w), h: Math.max(1, h ?? nat.h) };
}

interface FrameCanvasProps {
  orientation: Orientation;
  bg: PreviewBg;
  url: string;
  position: string | undefined;
  scale: string | undefined;
  rotation?: number;
  onChange: (over: { position?: string; scale?: string; rotation?: number }) => void;
}

// Angle (degrees, clockwise, 0 = up) from the box centre to a pointer, snapped to 15° when Shift is held.
function angleToPointer(center: { x: number; y: number }, ev: PointerEvent): number {
  const deg = (Math.atan2(ev.clientY - center.y, ev.clientX - center.x) * 180) / Math.PI + 90;
  const wrapped = ((Math.round(deg) + 180) % 360) - 180;

  return ev.shiftKey ? Math.round(wrapped / 15) * 15 : wrapped;
}

export const AnimationFrameCanvas = ({
  orientation,
  bg,
  url,
  position,
  scale,
  rotation,
  onChange,
}: FrameCanvasProps) => {
  const { t } = useTranslation('admin');
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  const frame = FRAME_SIZE[orientation];
  const k = DISPLAY_MAX / Math.max(frame.w, frame.h); // output px → display px
  const rect = resolveRect(position, scale, natural, frame);

  // A freshly added overlay carries no scale, so it defaults to its native size — which for a full-res
  // library image overflows the frame (the selection box + handle spilling outside). Once the real
  // dimensions load, normalize an unscaled oversized overlay to a contain-fit so the preview matches
  // what the engine will composite and the box hugs the frame. Smaller overlays keep their native size.
  const onNaturalLoad = (w: number, h: number) => {
    setNatural({ w, h });

    if (scale || (w <= frame.w && h <= frame.h)) return;

    const ratio = Math.min(frame.w / w, frame.h / h);
    onChange({ scale: `${Math.round(w * ratio)}:-1` });
  };

  // Drag room = the overlay's CENTER must stay within the frame. This always leaves room to move —
  // even a frame-filling overlay can be nudged without resizing first — while keeping it from being
  // dragged fully off-screen. (Clamping the whole box inside the frame collapsed to [0,0] for full-bleed
  // overlays, which is why they felt undraggable.)
  const xBounds: [number, number] = [-rect.w / 2, frame.w - rect.w / 2];
  const yBounds: [number, number] = [-rect.h / 2, frame.h - rect.h / 2];

  // Window listeners (not pointer capture) so a drag keeps tracking even when the cursor leaves the
  // tiny overlay box — the reliable cross-browser pattern. The base rect is snapshotted at press; the
  // bounds don't change during a single move/resize, so closing over them is safe.
  const begin = (mode: 'move' | 'resize') => (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const cx = e.clientX;
    const cy = e.clientY;
    const baseX = mode === 'move' ? rect.x : rect.w;
    const baseY = mode === 'move' ? rect.y : rect.h;

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - cx) / k;
      const dy = (ev.clientY - cy) / k;

      if (mode === 'move') {
        const x = clamp(Math.round(baseX + dx), xBounds[0], xBounds[1]);
        const y = clamp(Math.round(baseY + dy), yBounds[0], yBounds[1]);
        onChange({ position: `${x}:${y}` });

        return;
      }

      const w = clamp(Math.round(baseX + dx), MIN_SIZE, frame.w * 2);
      const h = clamp(Math.round(baseY + dy), MIN_SIZE, frame.h * 2);
      onChange({ scale: `${w}:${h}` });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Rotate gesture: spin the box around its centre, writing degrees (clockwise). Window listeners mirror
  // the move/resize pattern so the drag keeps tracking once the cursor leaves the small handle.
  const beginRotate = (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const box = (e.currentTarget as HTMLElement).closest('[data-frame]')?.getBoundingClientRect();

    if (!box) return;

    const center = { x: box.left + (rect.x + rect.w / 2) * k, y: box.top + (rect.y + rect.h / 2) * k };

    const onMove = (ev: PointerEvent) => {
      onChange({ rotation: angleToPointer(center, ev) });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 40 : 8;
    const move: Partial<Record<string, [number, number]>> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = move[e.key];

    if (!delta) return;

    e.preventDefault();
    const x = clamp(rect.x + delta[0], xBounds[0], xBounds[1]);
    const y = clamp(rect.y + delta[1], yBounds[0], yBounds[1]);
    onChange({ position: `${x}:${y}` });
  };

  // rotate() shares the box's centre as its transform-origin (the default), so the preview spins in place
  // exactly as the engine composites it — an unset/0 rotation leaves the box upright.
  const spin = rotation ? `rotate(${rotation}deg)` : undefined;
  const boxStyle = { left: rect.x * k, top: rect.y * k, width: rect.w * k, height: rect.h * k, transform: spin };

  return (
    <div data-frame className={cnFrame(bg)} style={{ width: frame.w * k, height: frame.h * k }}>
      {/* The overlay, clipped to the frame so a larger/offset overlay doesn't spill out. WebM renders in
          a <video> (alpha VP9 won't show in <img>); APNG/WebP/GIF in an <img>. */}
      <div className="absolute inset-0 overflow-hidden rounded-lg">
        {isAnimationVideo(url) ? (
          <video
            src={url}
            autoPlay
            loop
            muted
            playsInline
            draggable={false}
            onLoadedMetadata={(e) => {
              onNaturalLoad(e.currentTarget.videoWidth, e.currentTarget.videoHeight);
            }}
            className="pointer-events-none absolute select-none object-fill"
            style={boxStyle}
          />
        ) : (
          <img
            src={url}
            alt=""
            draggable={false}
            onLoad={(e) => {
              onNaturalLoad(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight);
            }}
            className="pointer-events-none absolute select-none object-fill"
            style={boxStyle}
          />
        )}
      </div>

      {/* Selection box + resize grip live on an UNclipped layer, so the grip stays grabbable even when
          the overlay fills the frame (the previous handle hid under the frame's clip). */}
      <div
        role="button"
        tabIndex={0}
        aria-label={t('animation.dragHint')}
        onPointerDown={begin('move')}
        onKeyDown={onKeyDown}
        className="absolute cursor-move touch-none rounded-[2px] ring-1 ring-brand-500/90 focus-visible:outline-none focus-visible:ring-2"
        style={boxStyle}
      >
        <span
          onPointerDown={begin('resize')}
          className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-nwse-resize touch-none rounded-full border-2 border-white bg-brand-500 shadow"
          aria-hidden
        />
        {/* Rotate grip above the box (top-centre): drag to spin, hold Shift to snap to 15°. */}
        <span
          onPointerDown={beginRotate}
          className="absolute -top-5 left-1/2 h-3.5 w-3.5 -translate-x-1/2 cursor-grab touch-none rounded-full border-2 border-white bg-brand-500 shadow active:cursor-grabbing"
          aria-hidden
        />
      </div>
    </div>
  );
};

const cnFrame = (bg: PreviewBg): string =>
  `relative shrink-0 rounded-lg border border-foreground/15 shadow-inner ${PREVIEW_BG_CLASS[bg]}`;
