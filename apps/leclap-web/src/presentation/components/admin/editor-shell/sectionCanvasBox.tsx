// Per-overlay box rendered on the center SectionCanvas: positioned by its [0,1] fractions, styled
// with the real font/size/color, owning its own move/resize pointer capture and (when editing) an
// inline textarea. Extracted from the legacy OverlayCanvas so the canvas half lives on its own.
import {
  useRef,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { TFunction } from 'i18next';
import { Type } from '@/presentation/components/icons';
import { findFont } from '@leclap/creative-kit/fonts';
import { displayFromTokens } from '@/lib/variableSyntax';
import { cn } from '@/lib/utils';
import type { TextOverlay, Orientation } from '../templateEditorModel';
import { previewFontPx } from '../overlayGeometry';

// 2% keyboard nudge step for a selected, non-editing overlay.
const NUDGE = 0.02;

// Arrow-key → [dx, dy] fraction offsets. Partial so an unmapped key reads `undefined`.
const NUDGE_OFFSETS: Partial<Record<string, [number, number]>> = {
  ArrowLeft: [-NUDGE, 0],
  ArrowRight: [NUDGE, 0],
  ArrowUp: [0, -NUDGE],
  ArrowDown: [0, NUDGE],
};

interface OverlayBoxProps {
  overlay: TextOverlay;
  index: number;
  t: TFunction<'admin'>;
  orientation: Orientation;
  active: boolean;
  editing: boolean;
  editRef: React.Ref<HTMLTextAreaElement>;
  frameRect: () => DOMRect | undefined;
  onSelect: (index: number) => void;
  onEdit: () => void;
  onMove: (index: number, clientX: number, clientY: number) => void;
  onResizeStart: (index: number, clientX: number, clientY: number) => void;
  onResize: (index: number, clientX: number, clientY: number) => void;
  onNudge: (index: number, dx: number, dy: number) => void;
  onDelete: (index: number) => void;
  onCommitText: (text: string) => void;
  onCaret: (start: number, end: number) => void;
  onEndEdit: () => void;
}

export const OverlayBox = (props: OverlayBoxProps) => {
  const { overlay, index, t, orientation, active, editing, frameRect } = props;
  const modeRef = useRef<'move' | 'resize' | null>(null);
  // Capture the pointer on the stable box element (not the tiny resize handle, which re-renders on
  // every fontsize change mid-drag and would lose the capture — making resize "do nothing").
  const bodyRef = useRef<HTMLDivElement>(null);

  const onBodyPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (editing) return;
    e.stopPropagation();
    props.onSelect(index);
    modeRef.current = 'move';
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (modeRef.current === null) return;
    e.stopPropagation();

    if (modeRef.current === 'resize') {
      props.onResize(index, e.clientX, e.clientY);

      return;
    }
    props.onMove(index, e.clientX, e.clientY);
  };

  const endGesture = (e: ReactPointerEvent<HTMLDivElement>) => {
    modeRef.current = null;

    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const onHandlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    props.onSelect(index);
    modeRef.current = 'resize';
    props.onResizeStart(index, e.clientX, e.clientY);
    bodyRef.current?.setPointerCapture(e.pointerId);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    handleBoxKey(e, index, props.onNudge, props.onDelete);
  };

  const previewH = frameRect()?.height ?? 0;

  return (
    <div
      ref={bodyRef}
      role="button"
      tabIndex={0}
      aria-label={overlayLabel(overlay, index, t)}
      aria-pressed={active}
      onPointerDown={onBodyPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      onDoubleClick={(e) => {
        e.stopPropagation();
        props.onSelect(index);
        props.onEdit();
      }}
      onKeyDown={onKeyDown}
      style={boxStyle(overlay, previewH, orientation)}
      className={cn(
        'absolute max-w-[92%] cursor-move touch-none whitespace-pre-wrap text-center leading-tight outline-none',
        active && 'rounded-[0.2em] ring-2 ring-brand-500'
      )}
    >
      <BoxContent
        overlay={overlay}
        editing={editing}
        t={t}
        editRef={props.editRef}
        onCommitText={props.onCommitText}
        onCaret={props.onCaret}
        onEndEdit={props.onEndEdit}
      />
      {active && !editing && <ResizeHandles onHandlePointerDown={onHandlePointerDown} />}
    </div>
  );
};

interface BoxContentProps {
  overlay: TextOverlay;
  editing: boolean;
  t: TFunction<'admin'>;
  editRef: React.Ref<HTMLTextAreaElement>;
  onCommitText: (text: string) => void;
  onCaret: (start: number, end: number) => void;
  onEndEdit: () => void;
}

// The text body: an editing textarea, the raw overlay text, or a muted placeholder when empty.
const BoxContent = ({ overlay, editing, t, editRef, onCommitText, onCaret, onEndEdit }: BoxContentProps) => {
  if (editing) {
    return (
      <textarea
        ref={editRef}
        autoFocus
        aria-label={t('overlay.editText')}
        value={overlay.text}
        placeholder={t('overlay.textPlaceholder')}
        onChange={(e) => {
          onCommitText(e.target.value);
          onCaret(e.target.selectionStart, e.target.selectionEnd);
        }}
        onSelect={(e) => {
          onCaret(e.currentTarget.selectionStart, e.currentTarget.selectionEnd);
        }}
        onBlur={onEndEdit}
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        onKeyDown={(e) => {
          e.stopPropagation();

          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onEndEdit();
          }
        }}
        rows={1}
        // `field-sizing: content` makes the textarea hug its text so the box (and its selection ring)
        // wraps the overlay content; min-w keeps the placeholder readable while empty.
        className="min-w-[3ch] resize-none bg-transparent text-center outline-none [field-sizing:content] [font:inherit] [color:inherit] placeholder:opacity-45"
      />
    );
  }

  // Empty, not editing: a hint chip that PREVIEWS the overlay's own typography — it inherits the box's
  // font face and scales with its font size (clamped to a legible floor) — so changing the font or
  // dragging the resize handles gives visible feedback even before any text is typed, while a tiny
  // placed-but-blank overlay stays a grabbable target.
  if (overlay.text.trim() === '') {
    return (
      <span className="pointer-events-none flex items-center gap-1 whitespace-nowrap text-[max(0.5em,11px)] leading-none font-medium tracking-normal normal-case opacity-60">
        <Type className="h-[1em] w-[1em]" aria-hidden />
        {t('overlay.doubleClickToEdit')}
      </span>
    );
  }

  return <span>{displayFromTokens(overlay.text)}</span>;
};

// Four corner resize handles. Each shares one pointerdown that arms a resize.
const ResizeHandles = ({
  onHandlePointerDown,
}: {
  onHandlePointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
}) => (
  <>
    {(['-top-1 -left-1', '-top-1 -right-1', '-bottom-1 -left-1', '-bottom-1 -right-1'] as const).map((pos) => (
      <div
        key={pos}
        aria-hidden
        onPointerDown={onHandlePointerDown}
        className={cn(
          'absolute h-3 w-3 cursor-nwse-resize rounded-full border-2 border-brand-500 bg-surface shadow',
          pos
        )}
      />
    ))}
  </>
);

// Parse a `#rgb`/`#rrggbb` hex into its [r, g, b] channel bytes, defaulting to black when malformed.
function hexChannels(hex: string): [number, number, number] {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.replace(/(.)/g, '$1$1') : raw;
  const int = Number.parseInt(full, 16);

  if (full.length !== 6 || !Number.isFinite(int)) return [0, 0, 0];

  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

// A CSS `rgba(...)` string for a hex color at the given [0,1] alpha, so the preview box matches the
// drawtext `boxcolor@opacity` the model emits.
function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexChannels(hex);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Inline style for an overlay box: position, the real font face, the WYSIWYG-scaled font size, color,
// and an optional padded background box at the author's opacity.
function boxStyle(overlay: TextOverlay, previewH: number, orientation: Orientation): CSSProperties {
  const base: CSSProperties = {
    left: `${overlay.x * 100}%`,
    top: `${overlay.y * 100}%`,
    transform: 'translate(-50%, -50%)',
    fontFamily: findFont(overlay.font)?.cssFamily ?? 'inherit',
    fontSize: `${previewFontPx(overlay.fontsize, previewH, orientation)}px`,
    color: overlay.fontcolor,
  };

  if (!overlay.box) return base;

  return {
    ...base,
    backgroundColor: rgba(overlay.boxcolor, overlay.boxOpacity),
    padding: '0.1em 0.3em',
    borderRadius: '0.15em',
  };
}

// Accessible label for an overlay box, using its text when present.
function overlayLabel(overlay: TextOverlay, index: number, t: TFunction<'admin'>): string {
  const text = overlay.text.trim();

  return text === '' ? t('overlay.label', { index: index + 1 }) : t('overlay.labelWithText', { text });
}

// Arrow keys nudge the selected box; Delete/Backspace removes it.
function handleBoxKey(
  e: ReactKeyboardEvent<HTMLDivElement>,
  index: number,
  onNudge: (index: number, dx: number, dy: number) => void,
  onDelete: (index: number) => void
): void {
  const offset = NUDGE_OFFSETS[e.key];

  if (offset) {
    e.preventDefault();
    onNudge(index, offset[0], offset[1]);

    return;
  }

  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    onDelete(index);
  }
}
