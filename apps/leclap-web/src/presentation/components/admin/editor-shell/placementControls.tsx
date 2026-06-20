// Canvas-free inspector for the selected image / animation overlay. The center canvas owns drag/resize, so
// the left inspector needs only the SETTINGS: a source picker + numeric placement (Position/Scale/Opacity/
// Rotation) and, for an animation, the playback controls — with NO drag canvas. Composed from the same
// extracted pieces OverlayPlacement / AnimationGallery use (PlacementFields, MediaPicker, AnimationSource,
// AnimationPlayback) so nothing duplicates the placement column or the animation panes.
import type { ImageOverlay, AnimationOverlay, Orientation } from '../templateEditorModel';
import { MediaPicker } from '../MediaPicker';
import { PlacementFields, type OverlayPlacementValue } from '../editor/placementFields';
import { AnimationSource, AnimationPlayback } from '../editor/animationSource';

interface ImageVariant {
  kind: 'image';
  orientation: Orientation;
  value: ImageOverlay;
  onChange: (patch: Partial<ImageOverlay>) => void;
}

interface AnimationVariant {
  kind: 'animation';
  orientation: Orientation;
  value: AnimationOverlay;
  onChange: (patch: Partial<AnimationOverlay>) => void;
}

export type PlacementControlsProps = ImageVariant | AnimationVariant;

export const PlacementControls = (props: PlacementControlsProps) => {
  if (props.kind === 'image') {
    return <ImagePlacement value={props.value} onChange={props.onChange} />;
  }

  return <AnimationPlacement value={props.value} onChange={props.onChange} />;
};

interface ImagePlacementProps {
  value: ImageOverlay;
  onChange: (patch: Partial<ImageOverlay>) => void;
}

// Source picker + numeric placement. Clearing the picker is a no-op here — deletion happens via the element
// list, not this inspector.
const ImagePlacement = ({ value, onChange }: ImagePlacementProps) => (
  <div className="space-y-3">
    <MediaPicker
      kind="picture"
      value={value.choice}
      onChange={(choice) => {
        if (choice) onChange({ choice });
      }}
    />
    <PlacementFields
      value={value}
      onChange={(patch: OverlayPlacementValue) => {
        onChange(patch);
      }}
    />
  </div>
);

interface AnimationPlacementProps {
  value: AnimationOverlay;
  onChange: (patch: Partial<AnimationOverlay>) => void;
}

// Source tabs + numeric placement + playback. The source picker may yield a fresh overlay (url/label); merge
// it into the current overlay via onChange.
const AnimationPlacement = ({ value, onChange }: AnimationPlacementProps) => (
  <div className="space-y-3">
    <AnimationSource
      value={value}
      onChange={(next) => {
        if (next) onChange(next);
      }}
    />
    <PlacementFields
      value={value}
      onChange={(patch: OverlayPlacementValue) => {
        onChange(patch);
      }}
    />
    <AnimationPlayback
      value={value}
      patch={(over) => {
        onChange(over);
      }}
    />
  </div>
);
