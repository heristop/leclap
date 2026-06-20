// The image/animation overlay wrappers the SectionCanvas renders. Each is a thin adapter around
// SectionCanvasMediaBox: it resolves the media URL (an ImageOverlay needs the effect-driven
// useChoicePreviewUrl hook, so it MUST be its own component — one hook call per item) and merges the
// box's move/resize/rotate/nudge patches back into the owning array via the change handler.
import type { AnimationOverlay, ImageOverlay, Orientation } from '../templateEditorModel';
import { useChoicePreviewUrl } from '../editor/useChoicePreviewUrl';
import { SectionCanvasMediaBox } from './sectionCanvasMediaBox';

// Geometry patches the box emits (a subset of the overlay fields).
type MediaPatch = { position: string } | { scale: string } | { rotation: number };

interface ImageOverlayItemProps {
  value: ImageOverlay;
  index: number;
  orientation: Orientation;
  active: boolean;
  frameRect: () => DOMRect | undefined;
  onPatch: (index: number, patch: MediaPatch) => void;
  onSelect: (index: number) => void;
  onDelete: (index: number) => void;
}

// One image overlay box. Renders nothing while its URL is unresolved (mirrors ImageOverlayField's
// `previewUrl !== ''` guard) so an unset image never draws a broken box.
export const ImageOverlayItem = ({
  value,
  index,
  orientation,
  active,
  frameRect,
  onPatch,
  onSelect,
  onDelete,
}: ImageOverlayItemProps) => {
  const url = useChoicePreviewUrl(value.choice);

  if (url === '') return null;

  return (
    <SectionCanvasMediaBox
      value={value}
      url={url}
      kind="image"
      orientation={orientation}
      active={active}
      frameRect={frameRect}
      onSelect={() => {
        onSelect(index);
      }}
      onMove={(patch) => {
        onPatch(index, patch);
      }}
      onResize={(patch) => {
        onPatch(index, patch);
      }}
      onRotate={(patch) => {
        onPatch(index, patch);
      }}
      onNudge={(patch) => {
        onPatch(index, patch);
      }}
      onDelete={() => {
        onDelete(index);
      }}
    />
  );
};

interface AnimationOverlayItemProps {
  value: AnimationOverlay;
  index: number;
  orientation: Orientation;
  active: boolean;
  frameRect: () => DOMRect | undefined;
  onPatch: (index: number, patch: MediaPatch) => void;
  onSelect: (index: number) => void;
  onDelete: (index: number) => void;
}

// One animation overlay box. Its URL is a direct library/blob path on the overlay, so no hook is
// needed; an empty url still draws (the picker only adds animations with a url).
export const AnimationOverlayItem = ({
  value,
  index,
  orientation,
  active,
  frameRect,
  onPatch,
  onSelect,
  onDelete,
}: AnimationOverlayItemProps) => (
  <SectionCanvasMediaBox
    value={value}
    url={value.url}
    kind="animation"
    orientation={orientation}
    active={active}
    frameRect={frameRect}
    onSelect={() => {
      onSelect(index);
    }}
    onMove={(patch) => {
      onPatch(index, patch);
    }}
    onResize={(patch) => {
      onPatch(index, patch);
    }}
    onRotate={(patch) => {
      onPatch(index, patch);
    }}
    onNudge={(patch) => {
      onPatch(index, patch);
    }}
    onDelete={() => {
      onDelete(index);
    }}
  />
);
