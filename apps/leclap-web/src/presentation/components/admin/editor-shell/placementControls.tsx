// Canvas-free inspector for the selected image / animation overlay. The center canvas owns drag/resize, so
// the left inspector needs only the SETTINGS: a source picker, the numeric placement (Position/Scale/
// Opacity/Rotation) tucked under a "Placement" disclosure whose summary mirrors the live values, and, for
// an animation, the playback controls — with NO drag canvas. Composed from the same extracted pieces
// OverlayPlacement / AnimationGallery use (PlacementFields, MediaPicker, AnimationSource, AnimationPlayback)
// so nothing duplicates the placement column or the animation panes.
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { ImageOverlay, AnimationOverlay, Orientation } from '../templateEditorModel';
import { MediaPicker } from '../MediaPicker';
import { PlacementFields, type OverlayPlacementValue } from '../editor/placementFields';
import { AnimationSource, AnimationPlayback } from '../editor/animationSource';
import { SectionDisclosure } from '../editor/SectionDisclosure';
import { ShapeControls } from './shape-controls';

// Mirror-flip glyphs for the collapsed summary (the expanded control spells the axes out).
const FLIP_GLYPH: Record<string, string> = { horizontal: '↔', vertical: '↕', both: '↔↕' };

// The collapsed "Placement" summary: every override at a glance — position "x:y", scale "w×h",
// a non-solid opacity, a non-zero rotation, and the mirror glyph — or "Default" when untouched,
// so collapsing the group never hides state.
export function placementSummary(t: TFunction<'admin'>, value: OverlayPlacementValue): string {
  const parts = [
    value.position ?? null,
    value.scale ? value.scale.replace(':', '×') : null,
    value.opacity !== undefined && value.opacity !== 1 ? `${Math.round(value.opacity * 100)}%` : null,
    value.rotation !== undefined && value.rotation !== 0 ? `${Math.round(value.rotation)}°` : null,
    value.flip ? FLIP_GLYPH[value.flip] : null,
  ].filter((part): part is string => part !== null);

  return parts.length > 0 ? parts.join(' · ') : t('summaryChip.default');
}

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
    return <ImagePlacement value={props.value} orientation={props.orientation} onChange={props.onChange} />;
  }

  return <AnimationPlacement value={props.value} onChange={props.onChange} />;
};

// The shared "Placement" disclosure: numeric fine-tuning stays one click away while the canvas
// remains the primary way to move/resize, and the summary keeps the values readable while collapsed.
const PlacementDisclosure = ({
  value,
  onChange,
}: {
  value: OverlayPlacementValue;
  onChange: (patch: OverlayPlacementValue) => void;
}) => {
  const { t } = useTranslation('admin');

  return (
    <SectionDisclosure label={t('animation.placementGroup')} summary={placementSummary(t, value)}>
      <PlacementFields value={value} onChange={onChange} />
    </SectionDisclosure>
  );
};

interface ImagePlacementProps {
  value: ImageOverlay;
  orientation: Orientation;
  onChange: (patch: Partial<ImageOverlay>) => void;
}

// Source picker + numeric placement. Clearing the picker is a no-op here — deletion happens via the element
// list, not this inspector. A shape element (an overlay carrying a `shape` recipe) swaps the source picker
// for the shape controls: its pixels are builder-rasterized, so there is no media source to pick.
const ImagePlacement = ({ value, orientation, onChange }: ImagePlacementProps) => (
  <div className="space-y-3">
    {value.shape ? (
      <ShapeControls value={value} shape={value.shape} orientation={orientation} onChange={onChange} />
    ) : (
      <MediaPicker
        kind="picture"
        value={value.choice}
        onChange={(choice) => {
          if (choice) onChange({ choice });
        }}
      />
    )}
    <PlacementDisclosure
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
    <PlacementDisclosure
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
