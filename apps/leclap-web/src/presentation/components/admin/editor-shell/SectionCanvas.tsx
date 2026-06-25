// The center monitor's WYSIWYG surface: the aspect-correct frame, the background (image backdrop or
// editable color-layer stack), and the draggable/resizable overlays (text, image, animation). Canvas
// ONLY — every font/size/color/box control lives in the left OverlayInspector. ALL selection is lifted
// to the shell via the `selection` prop + `onSelectElement`, so clicking an overlay here drives the
// inspector and vice-versa; the canvas keeps no selection state of its own.
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { AnimationOverlay, ImageOverlay, TextOverlay, Orientation, BackgroundLayer } from '../templateEditorModel';
import { clampFraction, fontSizeFromResize } from '../overlayGeometry';
import { BackgroundLayerBoxes } from '../BackgroundLayerBoxes';
import type { ElementRef, SectionSelectionState } from './useSectionSelection';
import { OverlayBox } from './sectionCanvasBox';
import { AnimationOverlayItem, ImageOverlayItem } from './sectionCanvasMediaItems';
import type { DropPayload, DropPoint } from './canvasDrop';
import { useCanvasDropTarget } from './useCanvasDropTarget';

// Preview-surface aspect classes per orientation (portrait 9:16, square 1:1, landscape 16:9).
// Height-driven, aspect-correct sizing: tall formats fill the stage HEIGHT (width derives from the
// aspect ratio); landscape fills the WIDTH. `max-h-full`/`max-w-full` keep the frame inside the
// stage, and the parent grid centers it on both axes.
const previewAspectClass: Record<Orientation, string> = {
  portrait: 'aspect-[9/16] h-full max-h-full w-auto max-w-full',
  square: 'aspect-square h-full max-h-full w-auto max-w-full',
  landscape: 'aspect-video w-full max-w-full h-auto max-h-full',
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

// The frame's backdrop image (e.g. an image_background). When absent and no editable layers are
// supplied, a neutral dark frame is shown instead.
export interface CanvasBackground {
  imageUrl?: string;
}

// An editable background-layer stack (color_background): the base plus draggable/resizable extra
// layers, painted behind the text overlays and written back on every gesture.
export interface CanvasLayers {
  items: BackgroundLayer[];
  onChange: (layers: BackgroundLayer[]) => void;
}

// Geometry patches a media box emits (a subset of the overlay fields).
type MediaPatch = { position: string } | { scale: string } | { rotation: number };

// Replace one overlay in a fresh array (immutable update for onChange).
const withOverlay = (overlays: TextOverlay[], index: number, patch: Partial<TextOverlay>): TextOverlay[] =>
  overlays.map((o, i) => (i === index ? { ...o, ...patch } : o));

// The overlay's centre in client pixels, from its [0,1] fractions and the frame rect.
const overlayCenter = (overlay: TextOverlay, rect: DOMRect): { cx: number; cy: number } => ({
  cx: rect.left + overlay.x * rect.width,
  cy: rect.top + overlay.y * rect.height,
});

// Merge a media patch into one item of its array (immutable update for image/animation overlays).
const withMedia = <T extends ImageOverlay | AnimationOverlay>(items: T[], index: number, patch: MediaPatch): T[] =>
  items.map((o, i) => (i === index ? { ...o, ...patch } : o));

interface SectionCanvasProps {
  overlays: TextOverlay[];
  orientation: Orientation;
  background?: CanvasBackground;
  layers?: CanvasLayers;
  images?: ImageOverlay[];
  animations?: AnimationOverlay[];
  selection: SectionSelectionState;
  onSelectElement: (ref: ElementRef | null) => void;
  onBeginEdit: () => void;
  onEndEdit: () => void;
  onChange: (overlays: TextOverlay[]) => void;
  onChangeImages?: (images: ImageOverlay[]) => void;
  onChangeAnimations?: (animations: AnimationOverlay[]) => void;
  onCanvasDrop?: (payload: DropPayload, point: DropPoint) => void;
}

// Read the active index for a given element kind from the shared selection (null when another kind,
// or nothing, is selected).
const activeIndex = (selection: SectionSelectionState, kind: ElementRef['kind']): number | null =>
  selection.element?.kind === kind ? selection.element.index : null;

export const SectionCanvas = ({
  overlays,
  orientation,
  background,
  layers,
  images,
  animations,
  selection,
  onSelectElement,
  onBeginEdit,
  onEndEdit,
  onChange,
  onChangeImages,
  onChangeAnimations,
  onCanvasDrop,
}: SectionCanvasProps) => {
  const { t } = useTranslation('admin');
  const frameRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const frameRect = (): DOMRect | undefined => frameRef.current?.getBoundingClientRect();
  const drop = useCanvasDropTarget({ frameRect, onCanvasDrop });

  const active = {
    text: activeIndex(selection, 'text'),
    layer: activeIndex(selection, 'layer'),
    image: activeIndex(selection, 'image'),
    animation: activeIndex(selection, 'animation'),
  };
  const hasBackground = Boolean(background?.imageUrl ?? layers?.items.length);
  const imageList = images ?? [];
  const animationList = animations ?? [];

  const moveTo = (index: number, clientX: number, clientY: number) => {
    const rect = frameRect();

    if (!rect) return;
    const x = clampFraction(clientX - rect.left, rect.width);
    const y = clampFraction(clientY - rect.top, rect.height);
    onChange(withOverlay(overlays, index, { x, y }));
  };

  // Corner-handle resize. The previous version mapped fontsize to the pointer's VERTICAL distance from
  // the box centre, so dragging a corner of a one-line box horizontally (the natural gesture) did
  // nothing. Scale proportionally instead: record the pointer's radial distance from the centre at
  // grab time, then grow/shrink the font by the ratio as it's dragged in any direction.
  const resizeStartRef = useRef<{ dist: number; fontsize: number } | null>(null);

  const resizeStart = (index: number, clientX: number, clientY: number) => {
    const rect = frameRect();

    if (!rect) return;
    const overlay = overlays[index];
    const { cx, cy } = overlayCenter(overlay, rect);
    resizeStartRef.current = { dist: Math.hypot(clientX - cx, clientY - cy) || 1, fontsize: overlay.fontsize };
  };

  const resizeTo = (index: number, clientX: number, clientY: number) => {
    const rect = frameRect();
    const start = resizeStartRef.current;

    if (!rect || !start) return;
    const overlay = overlays[index];
    const { cx, cy } = overlayCenter(overlay, rect);
    const dist = Math.hypot(clientX - cx, clientY - cy);
    const fontsize = fontSizeFromResize(start.fontsize, start.dist, dist);
    onChange(withOverlay(overlays, index, { fontsize }));
  };

  const nudge = (index: number, dx: number, dy: number) => {
    const overlay = overlays[index];
    onChange(withOverlay(overlays, index, { x: clamp01(overlay.x + dx), y: clamp01(overlay.y + dy) }));
  };

  const removeAt = (index: number) => {
    onSelectElement(null);
    onChange(overlays.filter((_, i) => i !== index));
  };

  const patchImage = (index: number, patch: MediaPatch) => {
    onChangeImages?.(withMedia(imageList, index, patch));
  };

  const removeImage = (index: number) => {
    onSelectElement(null);
    onChangeImages?.(imageList.filter((_, i) => i !== index));
  };

  const patchAnimation = (index: number, patch: MediaPatch) => {
    onChangeAnimations?.(withMedia(animationList, index, patch));
  };

  const removeAnimation = (index: number) => {
    onSelectElement(null);
    onChangeAnimations?.(animationList.filter((_, i) => i !== index));
  };

  return (
    <div
      ref={frameRef}
      onPointerDown={(e) => {
        if (e.target !== e.currentTarget) return;
        onSelectElement(null);
      }}
      onDragOver={drop.onDragOver}
      onDragLeave={drop.onDragLeave}
      onDrop={drop.onDrop}
      className={cn(
        'relative touch-none overflow-hidden rounded-xl border border-foreground/10 select-none',
        !hasBackground && 'bg-[radial-gradient(120%_120%_at_50%_0%,#2b2b3a,#15151f)]',
        drop.dragOver && 'ring-2 ring-brand-500/60',
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
          selectedIndex={active.layer}
          onSelect={(index) => {
            onSelectElement({ kind: 'layer', index });
          }}
        />
      )}
      {imageList.map((image, index) => (
        <ImageOverlayItem
          key={image.id}
          value={image}
          index={index}
          orientation={orientation}
          active={index === active.image}
          frameRect={frameRect}
          onPatch={patchImage}
          onSelect={(i) => {
            onSelectElement({ kind: 'image', index: i });
          }}
          onDelete={removeImage}
        />
      ))}
      {animationList.map((animation, index) => (
        <AnimationOverlayItem
          key={animation.id ?? index}
          value={animation}
          index={index}
          orientation={orientation}
          active={index === active.animation}
          frameRect={frameRect}
          onPatch={patchAnimation}
          onSelect={(i) => {
            onSelectElement({ kind: 'animation', index: i });
          }}
          onDelete={removeAnimation}
        />
      ))}
      {overlays.map((overlay, index) => (
        <OverlayBox
          key={index}
          overlay={overlay}
          index={index}
          t={t}
          orientation={orientation}
          active={index === active.text}
          editing={index === active.text && selection.editing}
          editRef={editRef}
          frameRect={frameRect}
          onSelect={(i) => {
            onSelectElement({ kind: 'text', index: i });
          }}
          onEdit={onBeginEdit}
          onMove={moveTo}
          onResizeStart={resizeStart}
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
