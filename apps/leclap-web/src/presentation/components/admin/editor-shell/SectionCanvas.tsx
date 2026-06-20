// The center monitor's WYSIWYG surface: the aspect-correct frame, the background (image backdrop or
// editable color-layer stack), and the draggable/resizable overlays (text, image, animation). Canvas
// ONLY — every font/size/color/box control lives in the left OverlayInspector. ALL selection is lifted
// to the shell via the `selection` prop + `onSelectElement`, so clicking an overlay here drives the
// inspector and vice-versa; the canvas keeps no selection state of its own.
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { AnimationOverlay, ImageOverlay, TextOverlay, Orientation } from '../templateEditorModel';
import { clampFraction, fontSizeFromPreview } from '../overlayGeometry';
import { BackgroundLayerBoxes } from '../BackgroundLayerBoxes';
import type { CanvasBackground, CanvasLayers } from '../OverlayCanvas';
import type { ElementRef, SectionSelectionState } from './useSectionSelection';
import { OverlayBox } from './sectionCanvasBox';
import { AnimationOverlayItem, ImageOverlayItem } from './sectionCanvasMediaItems';

// Preview-surface aspect classes per orientation (portrait 9:16, square 1:1, landscape 16:9).
const previewAspectClass: Record<Orientation, string> = {
  portrait: 'mx-auto aspect-[9/16] max-w-[16rem]',
  square: 'mx-auto aspect-square max-w-[18rem]',
  landscape: 'aspect-video',
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

// Geometry patches a media box emits (a subset of the overlay fields).
type MediaPatch = { position: string } | { scale: string } | { rotation: number };

// Replace one overlay in a fresh array (immutable update for onChange).
const withOverlay = (overlays: TextOverlay[], index: number, patch: Partial<TextOverlay>): TextOverlay[] =>
  overlays.map((o, i) => (i === index ? { ...o, ...patch } : o));

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
}: SectionCanvasProps) => {
  const { t } = useTranslation('admin');
  const frameRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const activeText = activeIndex(selection, 'text');
  const activeLayer = activeIndex(selection, 'layer');
  const activeImage = activeIndex(selection, 'image');
  const activeAnimation = activeIndex(selection, 'animation');
  const frameRect = (): DOMRect | undefined => frameRef.current?.getBoundingClientRect();
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
          selectedIndex={activeLayer}
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
          active={index === activeImage}
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
          active={index === activeAnimation}
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
          active={index === activeText}
          editing={index === activeText && selection.editing}
          editRef={editRef}
          frameRect={frameRect}
          onSelect={(i) => {
            onSelectElement({ kind: 'text', index: i });
          }}
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
