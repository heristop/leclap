import { AbsoluteFill, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { CLAMP, EASE } from '../film/cinema';

// The product-demo edit: the builder capture (public/captures/pick-background.mp4 — add a Background
// image scene, click through the photo library, the live preview swaps) re-framed for a square
// tutorial the way screen-demo tools do it — eased camera moves that follow the action, and a cursor
// the raw capture never had. This clip is the input of the real App Tutorial template
// (media/render-product-demo.ts), which adds the title card, step caption and tap pulse.
//
// Click targets are framed onto the spot where App Tutorial's tap-pulse overlay sits (540, 648), so
// the template's pulse reads as the tap.

export const PRODUCT_DEMO = { width: 1080, height: 1080, fps: 30, frames: 300 } as const;

/** The capture plays at 0.75x, stretching its 7.48s to the template's 10s walkthrough. */
const RATE = 0.75;
const TAP = { x: 540, y: 648 };

interface Shot {
  /** Focus point in capture pixels (1440x900) and where it lands in the square frame. */
  fx: number;
  fy: number;
  zoom: number;
  ax: number;
  ay: number;
}

const MENU: Shot = { fx: 285, fy: 560, zoom: 2.2, ax: TAP.x, ay: TAP.y }; // "Background image" item
const PICKER: Shot = { fx: 436, fy: 389, zoom: 2.3, ax: TAP.x, ay: TAP.y }; // "Green Forest" tile
const PREVIEW: Shot = { fx: 980, fy: 423, zoom: 1.25, ax: 540, ay: 540 }; // the live preview
const PREVIEW_PUSH: Shot = { ...PREVIEW, zoom: 1.36 };

/** [seconds, shot] keyframes, eased in between. Times line up with the capture's own events. */
const CAMERA: readonly (readonly [number, Shot])[] = [
  [0, MENU],
  [1.25, MENU],
  [2.05, PICKER],
  [2.75, PICKER],
  [3.5, PREVIEW],
  [10, PREVIEW_PUSH],
];

/** Cursor path in capture pixels: [seconds, x, y, pressed]. Clicks land just before the capture reacts. */
const CURSOR: readonly (readonly [number, number, number, boolean])[] = [
  [0.15, 430, 700, false],
  [1.05, 262, 562, false],
  [1.18, 262, 562, true],
  [1.3, 262, 562, false],
  [2.4, 420, 392, false],
  [2.52, 420, 392, true],
  [2.64, 420, 392, false],
];

const cameraAt = (t: number): Shot => {
  const next = CAMERA.findIndex(([time]) => time > t);

  if (next <= 0) return CAMERA[next === 0 ? 0 : CAMERA.length - 1][1];

  const [t0, a] = CAMERA[next - 1];
  const [t1, b] = CAMERA[next];
  const x = EASE.inOutCubic(interpolate(t, [t0, t1], [0, 1], CLAMP));
  const mix = (p: number, q: number): number => p + (q - p) * x;

  return {
    fx: mix(a.fx, b.fx),
    fy: mix(a.fy, b.fy),
    zoom: mix(a.zoom, b.zoom),
    ax: mix(a.ax, b.ax),
    ay: mix(a.ay, b.ay),
  };
};

export const ProductDemoTake = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const cam = cameraAt(t);
  const tx = cam.ax - cam.fx * cam.zoom;
  const ty = cam.ay - cam.fy * cam.zoom;

  const times = CURSOR.map(([time]) => time);
  const cx = interpolate(
    t,
    times,
    CURSOR.map(([, x]) => x),
    { ...CLAMP, easing: EASE.inOutCubic }
  );
  const cy = interpolate(
    t,
    times,
    CURSOR.map(([, , y]) => y),
    { ...CLAMP, easing: EASE.inOutCubic }
  );
  const pressed = CURSOR.some(([time, , , down], index) => down && t >= time && t < (CURSOR[index + 1]?.[0] ?? time));
  const cursorOpacity = interpolate(t, [0.05, 0.3, 2.8, 3.1], [0, 1, 1, 0], CLAMP);

  return (
    <AbsoluteFill style={{ background: '#101014', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 1440,
          height: 900,
          transform: `translate(${tx}px, ${ty}px) scale(${cam.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <OffthreadVideo
          src={staticFile('captures/pick-background.mp4')}
          playbackRate={RATE}
          muted
          style={{ width: 1440, height: 900, display: 'block' }}
        />
        {cursorOpacity > 0 && (
          <svg
            width={22}
            height={30}
            viewBox="0 0 22 30"
            style={{
              position: 'absolute',
              left: cx,
              top: cy,
              opacity: cursorOpacity,
              transform: `scale(${pressed ? 0.85 : 1})`,
              transformOrigin: '2px 2px',
              filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.5))',
            }}
          >
            <path
              d="M2 2 L2 24 L8 18.5 L12.5 28 L16 26.5 L11.5 17.3 L19 17 Z"
              fill="#fff"
              stroke="#111"
              strokeWidth={1.6}
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
    </AbsoluteFill>
  );
};
