// Canvas-free inspector for the selected image / animation overlay. The center canvas owns drag/resize, so
// the left inspector needs only the SETTINGS: a source picker, the numeric placement (Position/Scale/
// Opacity/Rotation) tucked under a "Placement" disclosure whose summary mirrors the live values, and, for
// an animation, the playback controls — with NO drag canvas. Composed from the same extracted pieces
// OverlayPlacement / AnimationGallery use (PlacementFields, MediaPicker, AnimationSource, AnimationPlayback)
// so nothing duplicates the placement column or the animation panes.
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { ImageOverlay, AnimationOverlay, Orientation, Reveal } from '../templateEditorModel';
import { MediaPicker } from '../MediaPicker';
import { PlacementFields, type OverlayPlacementValue } from '../editor/placementFields';
import { AnimationSource, AnimationPlayback, NumberRow } from '../editor/animationSource';
import { RevealControl } from '../editor/RevealControl';
import { SectionDisclosure } from '../editor/SectionDisclosure';
import { showWindowSeconds } from '../editor/SectionFields/image-show-window';
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

// A reveal value's type string (the sugar accepts both the bare string and the config object).
const revealTypeOf = (value: Reveal | undefined): string | undefined =>
  typeof value === 'string' ? value : value?.type;

// Collapsed "Timing & entrance" summary: the show window as "2s → 5s" (an open side leaves its slot
// blank) plus the entrance style by name, or "Default" when untouched — so collapsing never hides state.
export function timingSummary(t: TFunction<'admin'>, value: { start?: number; end?: number; motion?: Reveal }): string {
  const parts: string[] = [];
  const start = value.start ?? 0;
  const end = value.end ?? 0;

  if (start > 0 || end > 0) parts.push(`${start > 0 ? `${start}s` : ''} → ${end > 0 ? `${end}s` : ''}`.trim());

  const motion = revealTypeOf(value.motion);

  if (motion && motion !== 'none') parts.push(t(`reveal.${motion}`));

  return parts.length > 0 ? parts.join(' · ') : t('summaryChip.default');
}

// The playback extent as a label ("Forever" / "2 loops" / "3s"), mirroring AnimationPlayback's mode.
const playbackExtentLabel = (t: TFunction<'admin'>, value: AnimationOverlay): string => {
  if (value.duration !== undefined) return `${value.duration}s`;

  if (value.loops !== undefined || value.loop === false)
    return t('animation.summaryLoops', { count: value.loops ?? 1 });

  return t('animation.forever');
};

// Collapsed "Playback" summary: the extent plus a delayed start ("from 2s") when set.
export function playbackSummary(t: TFunction<'admin'>, value: AnimationOverlay): string {
  const parts = [playbackExtentLabel(t, value)];

  if ((value.start ?? 0) > 0) parts.push(t('animation.summaryFrom', { seconds: value.start }));

  return parts.join(' · ');
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
// for the shape controls: its pixels are builder-rasterized, so there is no media source to pick. Below the
// placement sit the same entrance affordances the panel's ImageOverlayField exposes: the show window
// (scene-relative seconds, 0 = unbounded — the engine lowers it to the overlay timeline enable) and the
// `motion` reveal (rise/slide/fade), so shapes and images get the full apparition vocabulary here too.
const ImagePlacement = ({ value, orientation, onChange }: ImagePlacementProps) => {
  const { t } = useTranslation('admin');

  return (
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
      {/* Finishing touches grouped like the text inspector's "Entrance & exit": the show window and
          the entrance stay one click away while the summary keeps the values readable collapsed. */}
      <SectionDisclosure label={t('imageOverlay.timingGroup')} summary={timingSummary(t, value)}>
        <NumberRow
          label={t('imageOverlay.startLabel')}
          value={value.start ?? 0}
          min={0}
          step={0.5}
          unit="s"
          onChange={(n) => {
            onChange({ start: showWindowSeconds(n) });
          }}
        />
        <NumberRow
          label={t('imageOverlay.endLabel')}
          value={value.end ?? 0}
          min={0}
          step={0.5}
          unit="s"
          onChange={(n) => {
            onChange({ end: showWindowSeconds(n) });
          }}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">{t('imageOverlay.windowHint')}</p>
        <RevealControl
          reveal={value.motion}
          onChange={(motion) => {
            onChange({ motion });
          }}
        />
      </SectionDisclosure>
    </div>
  );
};

interface AnimationPlacementProps {
  value: AnimationOverlay;
  onChange: (patch: Partial<AnimationOverlay>) => void;
}

// Source tabs + numeric placement + playback. The source picker may yield a fresh overlay (url/label); merge
// it into the current overlay via onChange. Playback tucks under a disclosure like Placement so the
// essentials (the source) lead; its summary mirrors the extent + start so nothing hides silently.
const AnimationPlacement = ({ value, onChange }: AnimationPlacementProps) => {
  const { t } = useTranslation('admin');

  return (
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
      <SectionDisclosure label={t('animation.playback')} summary={playbackSummary(t, value)}>
        <AnimationPlayback
          value={value}
          patch={(over) => {
            onChange(over);
          }}
        />
      </SectionDisclosure>
    </div>
  );
};
