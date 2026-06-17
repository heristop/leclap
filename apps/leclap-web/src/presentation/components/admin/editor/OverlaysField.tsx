// Combined overlay manager for a video section: animations and still images are both draggable,
// resizable layers composited over the clip, so the builder groups them under one disclosure with a
// magnetic Animation⇄Image toggle. Each mode reuses its dedicated list editor (AnimationOverlayField /
// ImageOverlayField); the toggle keeps both kinds one click apart without two separate panels.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SegmentedControl } from '@/presentation/components/ui';
import type { AnimationOverlay, EditorState, ImageOverlay } from '../templateEditorModel';
import { AnimationOverlayField } from './AnimationOverlayField';
import { ImageOverlayField } from './SectionFields/ImageOverlayField';

type OverlayMode = 'animation' | 'image';

interface OverlaysFieldProps {
  animations: AnimationOverlay[] | undefined;
  images: ImageOverlay[] | undefined;
  orientation: EditorState['orientation'];
  onAnimationsChange: (value: AnimationOverlay[] | undefined) => void;
  onImagesChange: (value: ImageOverlay[] | undefined) => void;
}

export const OverlaysField = ({
  animations,
  images,
  orientation,
  onAnimationsChange,
  onImagesChange,
}: OverlaysFieldProps) => {
  const { t } = useTranslation('admin');
  const animationCount = animations?.length ?? 0;
  const imageCount = images?.length ?? 0;
  // Open on the kind that already has layers (images only when there are images but no animations),
  // so re-opening a section lands on its populated tab.
  const [mode, setMode] = useState<OverlayMode>(imageCount > 0 && animationCount === 0 ? 'image' : 'animation');

  const withCount = (label: string, count: number) => (
    <span className="inline-flex items-center gap-1.5">
      {label}
      {count > 0 && (
        <span className="grid min-w-4 place-items-center rounded-full bg-brand-500/15 px-1 text-[0.65rem] font-bold tabular-nums text-brand-600 dark:text-brand-300">
          {count}
        </span>
      )}
    </span>
  );

  return (
    <div className="space-y-3">
      <SegmentedControl
        ariaLabel={t('overlays.kind')}
        value={mode}
        onChange={(value) => {
          setMode(value as OverlayMode);
        }}
        options={[
          { value: 'animation', label: withCount(t('overlays.animation'), animationCount) },
          { value: 'image', label: withCount(t('overlays.image'), imageCount) },
        ]}
      />
      {mode === 'animation' ? (
        <AnimationOverlayField value={animations} orientation={orientation} onChange={onAnimationsChange} />
      ) : (
        <ImageOverlayField value={images} orientation={orientation} onChange={onImagesChange} />
      )}
    </div>
  );
};
