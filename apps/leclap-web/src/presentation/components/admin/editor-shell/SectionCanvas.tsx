// The center monitor's WYSIWYG surface: the aspect-correct frame, the background (image backdrop or
// editable color-layer stack), and the draggable/resizable text overlays. Canvas ONLY — every
// font/size/color/box control lives in the left OverlayInspector. Selection is lifted to the shell
// via `selection` + the on{SelectText,BeginEdit,EndEdit} handlers, so clicking an overlay here drives
// the inspector and vice-versa.
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { TextOverlay, Orientation } from '../templateEditorModel';
import { clampFraction, fontSizeFromPreview } from '../overlayGeometry';
import { BackgroundLayerBoxes } from '../BackgroundLayerBoxes';
import type { CanvasBackground, CanvasLayers } from '../OverlayCanvas';
import type { SectionSelectionState } from './useSectionSelection';
import { OverlayBox } from './sectionCanvasBox';

// Preview-surface aspect classes per orientation (portrait 9:16, square 1:1, landscape 16:9).
const previewAspectClass: Record<Orientation, string> = {
  portrait: 'mx-auto aspect-[9/16] max-w-[16rem]',
  square: 'mx-auto aspect-square max-w-[18rem]',
  landscape: 'aspect-video',
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

// Replace one overlay in a fresh array (immutable update for onChange).
const withOverlay = (overlays: TextOverlay[], index: number, patch: Partial<TextOverlay>): TextOverlay[] =>
  overlays.map((o, i) => (i === index ? { ...o, ...patch } : o));

interface SectionCanvasProps {
  overlays: TextOverlay[];
  orientation: Orientation;
  background?: CanvasBackground;
  layers?: CanvasLayers;
  selection: SectionSelectionState;
  onSelectText: (index: number | null) => void;
  onBeginEdit: () => void;
  onEndEdit: () => void;
  onChange: (overlays: TextOverlay[]) => void;
}

export const SectionCanvas = ({
  overlays,
  orientation,
  background,
  layers,
  selection,
  onSelectText,
  onBeginEdit,
  onEndEdit,
  onChange,
}: SectionCanvasProps) => {
  const { t } = useTranslation('admin');
  const frameRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);
  // The color-layer stack keeps its own internal selection for now (Phase 1 only lifts text). A layer
  // selection clears the text selection so the two affordances stay mutually exclusive on the canvas.
  const [selectedLayer, setSelectedLayer] = useState<number | null>(null);

  const activeText = selection.element?.kind === 'text' ? selection.element.index : null;
  const frameRect = (): DOMRect | undefined => frameRef.current?.getBoundingClientRect();
  const hasBackground = Boolean(background?.imageUrl ?? layers?.items.length);

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

  const nudge = (index: number, dx: number, dy: number) => {
    const overlay = overlays[index];
    onChange(withOverlay(overlays, index, { x: clamp01(overlay.x + dx), y: clamp01(overlay.y + dy) }));
  };

  const removeAt = (index: number) => {
    onSelectText(null);
    onChange(overlays.filter((_, i) => i !== index));
  };

  const selectLayer = (index: number) => {
    onSelectText(null);
    setSelectedLayer(index);
  };

  const selectText = (index: number) => {
    setSelectedLayer(null);
    onSelectText(index);
  };

  return (
    <div
      ref={frameRef}
      onPointerDown={(e) => {
        if (e.target !== e.currentTarget) return;
        onSelectText(null);
        setSelectedLayer(null);
      }}
      className={cn(
        'relative w-full touch-none overflow-hidden rounded-xl border border-foreground/10 select-none',
        !hasBackground && 'bg-[radial-gradient(120%_120%_at_50%_0%,#2b2b3a,#15151f)]',
        previewAspectClass[orientation]
      )}
    >
      {background?.imageUrl && (
        <img
          aria-hidden
          alt=""
          src={background.imageUrl}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      )}
      {layers && (
        <BackgroundLayerBoxes
          layers={layers.items}
          onChange={layers.onChange}
          frameRect={frameRect}
          selectedIndex={selectedLayer}
          onSelect={selectLayer}
        />
      )}
      {overlays.map((overlay, index) => (
        <OverlayBox
          key={index}
          overlay={overlay}
          index={index}
          t={t}
          orientation={orientation}
          active={index === activeText}
          editing={index === activeText && selection.editing}
          editRef={editRef}
          frameRect={frameRect}
          onSelect={selectText}
          onEdit={onBeginEdit}
          onMove={moveTo}
          onResize={resizeTo}
          onNudge={nudge}
          onDelete={removeAt}
          onCommitText={(text) => {
            onChange(withOverlay(overlays, index, { text }));
          }}
          onCaret={() => {
            // Caret tracking for at-cursor variable insertion is a later phase; the inspector appends
            // the variable token for now (see OverlayInspector).
          }}
          onEndEdit={onEndEdit}
        />
      ))}
    </div>
  );
};
