import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { LAVENDER, PINK, YELLOW } from '../../../brand';
import { OSWALD } from '../../../fonts';
import { CLAMP } from '../../../film/cinema';
import { MONO, Terminal } from '../../../film/devices';

// Step 1 · Implement: the agent's log beside the diff it writes — the faint link becomes a button and
// a cart drawer. The code mirrors the change the demo shop's before/after pages show.

interface Line {
  at: number;
  verb: string;
  text: string;
  ok?: boolean;
}

const LOG: readonly Line[] = [
  { at: 8, verb: 'task', text: 'make “Add to cart” obvious' },
  { at: 24, verb: 'read', text: 'src/product/ProductPage.tsx' },
  { at: 40, verb: 'edit', text: 'src/product/AddToCart.tsx', ok: true },
  { at: 58, verb: 'edit', text: 'src/cart/CartDrawer.tsx', ok: true },
];

type Kind = 'ctx' | 'del' | 'add';

const DIFF: readonly (readonly [Kind, string])[] = [
  ['ctx', 'export function AddToCart({ price }) {'],
  ['del', '  return <a className="tiny-add">add to cart</a>;'],
  ['add', '  const [added, setAdded] = useState(false);'],
  ['add', '  return (<>'],
  ['add', '    <Button size="lg" onClick={() => setAdded(true)}>'],
  ['add', '      Add to cart — €{price}'],
  ['add', '    </Button>'],
  ['add', '    <CartDrawer open={added} />'],
  ['add', '  </>);'],
  ['ctx', '}'],
];

const KIND = {
  ctx: { mark: ' ', color: '#c9cbe0', bg: 'transparent' },
  del: { mark: '−', color: '#ffb3ba', bg: 'rgba(255,95,109,0.14)' },
  add: { mark: '+', color: '#b7f5cf', bg: 'rgba(126,226,168,0.12)' },
} as const;

export const ImplementPanel = ({ at, testsPass }: { at: number; testsPass: number }) => {
  const frame = useCurrentFrame() - at;
  const { fps } = useVideoConfig();
  const terminal = spring({ frame, fps, config: { damping: 16 } });
  const diff = spring({ frame: frame - 30, fps, config: { damping: 16 } });

  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 120,
          top: 330,
          opacity: terminal,
          transform: `translateY(${(1 - terminal) * 40}px)`,
        }}
      >
        <Terminal width={800} height={560} title="agent · kiln-co/shop">
          {LOG.map((line) => (
            <LogLine key={line.text} line={line} frame={frame} />
          ))}
          {frame >= testsPass - at && (
            <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
              <span style={{ color: PINK, fontWeight: 700 }}>test </span>
              <span style={{ color: '#7ee2a8', fontWeight: 700 }}>14 passed ✓</span>
            </div>
          )}
        </Terminal>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 980,
          top: 330,
          width: 820,
          height: 560,
          borderRadius: 18,
          overflow: 'hidden',
          background: 'rgba(14,14,22,0.94)',
          border: `1px solid ${LAVENDER}44`,
          boxShadow: '0 40px 90px rgba(0,0,0,0.6)',
          opacity: diff,
          transform: `translateY(${(1 - diff) * 40}px)`,
        }}
      >
        <div
          style={{
            height: 46,
            display: 'flex',
            alignItems: 'center',
            padding: '0 20px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            fontFamily: MONO,
            fontSize: 18,
            color: '#8a8ca6',
          }}
        >
          src/product/AddToCart.tsx
          <span style={{ marginLeft: 'auto', fontFamily: OSWALD, fontSize: 18, letterSpacing: 1 }}>
            <span style={{ color: '#7ee2a8' }}>+18</span> <span style={{ color: '#ff5f6d' }}>−3</span>
          </span>
        </div>
        <div style={{ padding: '18px 0', fontFamily: MONO, fontSize: 21, lineHeight: 1.7 }}>
          {DIFF.map(([kind, code], index) => {
            const show = interpolate(frame, [40 + index * 4, 44 + index * 4], [0, 1], CLAMP);

            return (
              <div
                key={`${kind}-${code}`}
                style={{
                  display: 'flex',
                  whiteSpace: 'pre',
                  background: KIND[kind].bg,
                  color: KIND[kind].color,
                  opacity: show,
                  transform: `translateX(${(1 - show) * 24}px)`,
                }}
              >
                <span style={{ width: 44, textAlign: 'center', color: KIND[kind].color, opacity: 0.8 }}>
                  {KIND[kind].mark}
                </span>
                {code}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

const LogLine = ({ line, frame }: { line: Line; frame: number }) => {
  if (frame < line.at) return null;

  const typed = Math.round(interpolate(frame, [line.at, line.at + 9], [0, line.text.length], CLAMP));

  return (
    <div style={{ display: 'flex', gap: 14, marginBottom: 8, whiteSpace: 'pre' }}>
      <span style={{ color: PINK, fontWeight: 700 }}>{line.verb.padEnd(5)}</span>
      <span>{line.text.slice(0, typed)}</span>
      {line.ok && frame >= line.at + 12 && (
        <span style={{ marginLeft: 'auto', color: YELLOW, fontWeight: 700 }}>✓</span>
      )}
    </div>
  );
};
