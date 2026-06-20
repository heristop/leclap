// Animated-overlay picker for a visual section, mirroring the image MediaPicker: a Library / Upload / Url
// tabbed submenu over the same SegmentedControl pill. When an overlay is selected the shared OverlayPlacement
// panel exposes Position + Scale + Opacity + Rotation and the drag canvas (the same controls as the image
// overlay); the playback-only loop / keep-last-frame controls stay animation-specific. Writes section.animation.
// The source picker (AnimationSource) and playback controls (AnimationPlayback) live in animationSource so the
// canvas-less PlacementControls inspector reuses the exact same pieces instead of carrying a copy.
import { type AnimationAsset } from '@/data/mediaCatalog';
import type { AnimationOverlay, Orientation } from '../templateEditorModel';
import { OverlayPlacement } from './OverlayPlacement';
import { AnimationSource, AnimationPlayback } from './animationSource';

interface AnimationGalleryProps {
  value: AnimationOverlay | undefined;
  orientation: Orientation;
  onChange: (value?: AnimationOverlay) => void;
  /** Override the dynamic library with a curated list (config-driven); defaults to all bundled animations. */
  library?: AnimationAsset[];
}

export const AnimationGallery = ({ value, orientation, onChange, library }: AnimationGalleryProps) => {
  const patch = (over: Partial<AnimationOverlay>) => {
    if (value) onChange({ ...value, ...over });
  };

  return (
    <div className="rounded-xl border border-foreground/10 bg-surface-2/40 p-3">
      <AnimationSource value={value} onChange={onChange} library={library} />

      {value ? (
        <div className="mt-3 space-y-2">
          <OverlayPlacement orientation={orientation} url={value.url} value={value} onChange={patch} />
          {/* Playback-only — these don't apply to a still image, so they stay out of OverlayPlacement. */}
          <AnimationPlayback value={value} patch={patch} />
        </div>
      ) : null}
    </div>
  );
};
