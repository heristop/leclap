import {
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Trash2, Plus, Type, ChevronDown } from 'lucide-react';
import { FONTS, findFont } from 'ffmpeg-video-composer/src/shared/library/fonts.ts';
import {
  Button,
  Checkbox,
  ColorPicker,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui';
import { cn } from '@/lib/utils';
import { newOverlay, type TextOverlay } from './templateEditorModel';
import { clampFraction, fontSizeFromPreview, previewFontPx } from './overlayGeometry';

type Orientation = 'landscape' | 'portrait';

interface OverlayCanvasProps {
  overlays: TextOverlay[];
  orientation: Orientation;
  variables: string[];
  onChange: (overlays: TextOverlay[]) => void;
}

// 2% keyboard nudge step for a selected, non-editing overlay.
const NUDGE = 0.02;

// Arrow-key → [dx, dy] fraction offsets. Partial so an unmapped key reads `undefined`.
const NUDGE_OFFSETS: Partial<Record<string, [number, number]>> = {
  ArrowLeft: [-NUDGE, 0],
  ArrowRight: [NUDGE, 0],
  ArrowUp: [0, -NUDGE],
  ArrowDown: [0, NUDGE],
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

// Replace one overlay in a fresh array (immutable update for onChange).
const withOverlay = (overlays: TextOverlay[], index: number, patch: Partial<TextOverlay>): TextOverlay[] =>
  overlays.map((o, i) => (i === index ? { ...o, ...patch } : o));

// The video frame with every overlay on it, plus a docked toolbar. Owns all
// direct-manipulation state (selection + inline edit); each mutation builds a new
// overlays array and calls onChange.
export const OverlayCanvas = ({ overlays, orientation, variables, onChange }: OverlayCanvasProps) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);
  // Last caret range in the editing textarea, kept across blur so the variable
  // menu (which steals focus) can still insert at the caret of the active box.
  const caretRef = useRef<{ index: number; start: number; end: number } | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const frameRect = (): DOMRect | undefined => frameRef.current?.getBoundingClientRect();

  const moveTo = (index: number, clientX: number, clientY: number) => {
    const rect = frameRect();

    if (!rect) return;
    const x = clampFraction(clientX - rect.left, rect.width);
    const y = clampFraction(clientY - rect.top, rect.height);
    onChange(withOverlay(overlays, index, { x, y }));
  };

  const resizeTo = (index: number, clientY: number) => {
    const rect = frameRect();

    if (!rect) return;
    const overlay = overlays[index];
    const centerY = rect.top + overlay.y * rect.height;
    const halfHeightPx = Math.abs(clientY - centerY);
    const fontsize = fontSizeFromPreview(halfHeightPx * 2, rect.height, orientation);
    onChange(withOverlay(overlays, index, { fontsize }));
  };

  const select = (index: number) => {
    setActiveIndex(index);
    setEditingIndex(null);
  };

  const deselect = () => {
    setActiveIndex(null);
    setEditingIndex(null);
  };

  const beginEdit = (index: number) => {
    setActiveIndex(index);
    setEditingIndex(index);
  };

  const patchActive = (patch: Partial<TextOverlay>) => {
    if (activeIndex === null) return;
    onChange(withOverlay(overlays, activeIndex, patch));
  };

  const removeAt = (index: number) => {
    setActiveIndex(null);
    setEditingIndex(null);
    onChange(overlays.filter((_, i) => i !== index));
  };

  const addText = () => {
    const index = overlays.length;
    onChange([...overlays, newOverlay()]);
    beginEdit(index);
  };

  const insertVariable = (name: string) => {
    if (activeIndex === null) return;
    const caret = caretRef.current?.index === activeIndex ? caretRef.current : null;
    const next = textWithVariable(overlays[activeIndex].text, name, caret);
    onChange(withOverlay(overlays, activeIndex, { text: next }));
  };

  const nudge = (index: number, dx: number, dy: number) => {
    const overlay = overlays[index];
    onChange(withOverlay(overlays, index, { x: clamp01(overlay.x + dx), y: clamp01(overlay.y + dy) }));
  };

  return (
    <div className="sm:col-span-2">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">Text overlays</span>
      <CanvasFrame ref={frameRef} orientation={orientation} onDeselect={deselect}>
        {overlays.map((overlay, index) => (
          <OverlayBox
            key={index}
            overlay={overlay}
            index={index}
            orientation={orientation}
            active={index === activeIndex}
            editing={index === editingIndex}
            editRef={editRef}
            frameRect={frameRect}
            onSelect={select}
            onEdit={beginEdit}
            onMove={moveTo}
            onResize={resizeTo}
            onNudge={nudge}
            onDelete={removeAt}
            onCommitText={(text) => {
              onChange(withOverlay(overlays, index, { text }));
            }}
            onCaret={(start, end) => {
              caretRef.current = { index, start, end };
            }}
            onEndEdit={() => {
              setEditingIndex(null);
            }}
          />
        ))}
      </CanvasFrame>
      <OverlayToolbar
        overlay={activeIndex === null ? null : overlays[activeIndex]}
        variables={variables}
        onPatch={patchActive}
        onInsertVariable={insertVariable}
        onDelete={() => {
          if (activeIndex !== null) removeAt(activeIndex);
        }}
        onAdd={addText}
      />
    </div>
  );
};

interface Caret {
  start: number;
  end: number;
}

// Build the new overlay text with `{{ name }}` inserted at the last known caret
// range, or appended when there is no caret. Kept pure (outside the component).
function textWithVariable(current: string, name: string, caret: Caret | null): string {
  const token = `{{ ${name} }}`;

  if (!caret) return current + token;

  return current.slice(0, caret.start) + token + current.slice(caret.end);
}

interface CanvasFrameProps {
  orientation: Orientation;
  onDeselect: () => void;
  children: React.ReactNode;
  ref: React.Ref<HTMLDivElement>;
}

// The aspect-correct preview surface. A pointerdown on the bare frame deselects.
const CanvasFrame = ({ orientation, onDeselect, children, ref }: CanvasFrameProps) => (
  <div
    ref={ref}
    onPointerDown={(e) => {
      if (e.target === e.currentTarget) onDeselect();
    }}
    className={cn(
      'relative w-full touch-none overflow-hidden rounded-xl border border-foreground/10 select-none',
      'bg-[radial-gradient(120%_120%_at_50%_0%,#2b2b3a,#15151f)]',
      orientation === 'portrait' ? 'mx-auto aspect-[9/16] max-w-[16rem]' : 'aspect-video'
    )}
  >
    {children}
  </div>
);

interface OverlayBoxProps {
  overlay: TextOverlay;
  index: number;
  orientation: Orientation;
  active: boolean;
  editing: boolean;
  editRef: React.Ref<HTMLTextAreaElement>;
  frameRect: () => DOMRect | undefined;
  onSelect: (index: number) => void;
  onEdit: (index: number) => void;
  onMove: (index: number, clientX: number, clientY: number) => void;
  onResize: (index: number, clientY: number) => void;
  onNudge: (index: number, dx: number, dy: number) => void;
  onDelete: (index: number) => void;
  onCommitText: (text: string) => void;
  onCaret: (start: number, end: number) => void;
  onEndEdit: () => void;
}

// Per-overlay box: positioned by its [0,1] fractions, styled with the real font,
// scaled size and color. Owns its move/resize pointer capture and (when editing)
// renders an inline textarea on top.
const OverlayBox = (props: OverlayBoxProps) => {
  const { overlay, index, orientation, active, editing, frameRect } = props;
  const modeRef = useRef<'move' | 'resize' | null>(null);

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
      props.onResize(index, e.clientY);

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
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    handleBoxKey(e, index, props.onNudge, props.onDelete);
  };

  const previewH = frameRect()?.height ?? 0;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={overlayLabel(overlay, index)}
      aria-pressed={active}
      onPointerDown={onBodyPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      onDoubleClick={(e) => {
        e.stopPropagation();
        props.onEdit(index);
      }}
      onKeyDown={onKeyDown}
      style={boxStyle(overlay, previewH, orientation)}
      className={cn(
        'absolute max-w-[92%] cursor-move touch-none whitespace-pre-wrap text-center leading-tight outline-none',
        active && 'ring-2 ring-brand-500 ring-offset-1 ring-offset-black/40'
      )}
    >
      <BoxContent
        overlay={overlay}
        editing={editing}
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
  editRef: React.Ref<HTMLTextAreaElement>;
  onCommitText: (text: string) => void;
  onCaret: (start: number, end: number) => void;
  onEndEdit: () => void;
}

// The text body: either an editing textarea, the raw overlay text, or a muted
// placeholder when empty.
const BoxContent = ({ overlay, editing, editRef, onCommitText, onCaret, onEndEdit }: BoxContentProps) => {
  if (editing) {
    return (
      <textarea
        ref={editRef}
        autoFocus
        aria-label="Edit overlay text"
        value={overlay.text}
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
        className="w-full resize-none bg-transparent text-center outline-none [font:inherit] [color:inherit]"
      />
    );
  }

  if (overlay.text.trim() === '') {
    return <span className="opacity-50">Double-click to edit</span>;
  }

  return <span>{overlay.text}</span>;
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

interface OverlayToolbarProps {
  overlay: TextOverlay | null;
  variables: string[];
  onPatch: (patch: Partial<TextOverlay>) => void;
  onInsertVariable: (name: string) => void;
  onDelete: () => void;
  onAdd: () => void;
}

// Docked toolbar acting on the selected overlay. Shows a hint when nothing is
// selected; always offers "+ Add text".
const OverlayToolbar = ({ overlay, variables, onPatch, onInsertVariable, onDelete, onAdd }: OverlayToolbarProps) => (
  <div className="mt-3 rounded-xl border border-foreground/10 bg-surface-2/50 p-3">
    {overlay ? (
      <SelectedControls
        overlay={overlay}
        variables={variables}
        onPatch={onPatch}
        onInsertVariable={onInsertVariable}
        onDelete={onDelete}
      />
    ) : (
      <p className="text-xs text-gray-500 dark:text-gray-400">Select a text — or add one below.</p>
    )}
    <button
      type="button"
      onClick={onAdd}
      className="tap mt-3 inline-flex items-center gap-1.5 rounded-lg bg-foreground/5 px-2.5 py-1.5 text-xs text-gray-600 transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 active:scale-[0.97] dark:text-gray-300"
    >
      <Plus className="h-3.5 w-3.5" /> Add text
    </button>
  </div>
);

interface SelectedControlsProps {
  overlay: TextOverlay;
  variables: string[];
  onPatch: (patch: Partial<TextOverlay>) => void;
  onInsertVariable: (name: string) => void;
  onDelete: () => void;
}

// The styling controls for the selected overlay (font, size, color, box, variable
// insert, delete).
const SelectedControls = ({ overlay, variables, onPatch, onInsertVariable, onDelete }: SelectedControlsProps) => {
  const sizeId = useId();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <FontSelect
          value={overlay.font}
          onChange={(font) => {
            onPatch({ font });
          }}
        />
        <div className="min-w-[10rem] flex-1">
          <label htmlFor={sizeId} className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">
            Size — {overlay.fontsize}px
          </label>
          <input
            id={sizeId}
            type="range"
            min={8}
            max={300}
            value={overlay.fontsize}
            onChange={(e) => {
              onPatch({ fontsize: Number(e.target.value) });
            }}
            className="h-2 w-full cursor-pointer accent-brand-500"
          />
        </div>
        <VariableMenu variables={variables} onInsert={onInsertVariable} />
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete text"
          className="tap rounded-lg p-2 text-gray-500 transition-colors hover:bg-foreground/5 hover:text-[var(--color-error)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error)]/40 active:scale-90"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">Color</label>
          <ColorPicker
            aria-label="Text color"
            value={overlay.fontcolor}
            onChange={(fontcolor) => {
              onPatch({ fontcolor });
            }}
          />
        </div>
        <BoxControls overlay={overlay} onPatch={onPatch} />
      </div>
    </div>
  );
};

// The "Box" toggle plus its color picker and opacity slider (revealed only when
// the box is on).
const BoxControls = ({
  overlay,
  onPatch,
}: {
  overlay: TextOverlay;
  onPatch: (patch: Partial<TextOverlay>) => void;
}) => {
  const opacityId = useId();

  return (
    <div className="space-y-2">
      <label className="flex w-fit cursor-pointer select-none items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
        <Checkbox
          checked={overlay.box}
          onCheckedChange={(c) => {
            onPatch({ box: c === true });
          }}
        />{' '}
        Box
      </label>
      {overlay.box && (
        <div className="space-y-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">
              Box color
            </label>
            <ColorPicker
              aria-label="Box color"
              value={overlay.boxcolor}
              onChange={(boxcolor) => {
                onPatch({ boxcolor });
              }}
            />
          </div>
          <div>
            <label
              htmlFor={opacityId}
              className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400"
            >
              Box opacity — {Math.round(overlay.boxOpacity * 100)}%
            </label>
            <input
              id={opacityId}
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={overlay.boxOpacity}
              onChange={(e) => {
                onPatch({ boxOpacity: Number(e.target.value) });
              }}
              className="h-2 w-full cursor-pointer accent-brand-500"
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Design-system font picker over the curated FONTS catalog. Each option previews
// in its own face.
const FontSelect = ({ value, onChange }: { value: string; onChange: (id: string) => void }) => (
  <div className="min-w-[9rem]">
    <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">Font</span>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label="Font" className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {FONTS.map((font) => (
          <SelectItem key={font.id} value={font.id} style={{ fontFamily: font.cssFamily }}>
            {font.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

// "Insert variable ▾" dropdown. Lists the available variable names; choosing one
// inserts `{{ name }}`. Disabled when there are no variables.
const VariableMenu = ({ variables, onInsert }: { variables: string[]; onInsert: (name: string) => void }) => {
  const [open, setOpen] = useState(false);
  const disabled = variables.length === 0;

  if (disabled) {
    return (
      <Button type="button" variant="secondary" size="sm" disabled title="Add a form field or global variable first">
        Insert variable <ChevronDown className="h-3.5 w-3.5" />
      </Button>
    );
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
        }}
        onBlur={() => {
          setOpen(false);
        }}
      >
        Insert variable <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute z-10 mt-1 max-h-48 min-w-[10rem] overflow-auto rounded-xl border border-divider bg-surface p-1 shadow-[var(--shadow-lg)]"
        >
          {variables.map((name) => (
            <button
              key={name}
              type="button"
              role="menuitem"
              onMouseDown={(e) => {
                e.preventDefault();
                onInsert(name);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-foreground hover:bg-brand-500/15"
            >
              <Type className="h-3.5 w-3.5 text-gray-400" /> {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Parse a `#rgb`/`#rrggbb` hex into its [r, g, b] channel bytes, defaulting to
// black when the value is malformed.
function hexChannels(hex: string): [number, number, number] {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.replace(/(.)/g, '$1$1') : raw;
  const int = Number.parseInt(full, 16);

  if (full.length !== 6 || !Number.isFinite(int)) return [0, 0, 0];

  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

// A CSS `rgba(...)` string for a hex color at the given [0,1] alpha, so the
// preview box matches the drawtext `boxcolor@opacity` the model emits.
function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexChannels(hex);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Inline style for an overlay box: position, the real font face, the WYSIWYG-scaled
// font size, color, and an optional padded background box at the author's opacity.
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
function overlayLabel(overlay: TextOverlay, index: number): string {
  const text = overlay.text.trim();

  return text === '' ? `Text ${index + 1}` : `Text: ${text}`;
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
