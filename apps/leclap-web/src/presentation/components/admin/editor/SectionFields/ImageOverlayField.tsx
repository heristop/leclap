// Manage a video section's still-image overlays: a list of images each picked from the library /
// uploaded / pasted, then dragged + resized on the output frame. Reuses MediaPicker for selection and the
// shared OverlayPlacement panel for placement (Position/Scale/Opacity/Rotation + drag canvas, the same
// controls as the animation overlay) — the image equivalent of AnimationGallery. Used by VideoFields.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { findBackground } from '@/data/mediaCatalog';
import { browserMediaService } from '@/services/browserMediaService';
import { makeTemplateId, type EditorState, type ImageOverlay, type MediaChoice } from '../../templateEditorModel';
import { MediaPicker } from '../../MediaPicker';
import { OverlayLayer } from '../OverlayLayer';
import { OverlayPlacement } from '../OverlayPlacement';

// Resolve a MediaChoice to a previewable URL for the placement canvas: library → curated url, pasted
// url → as-is, upload → a transient object URL read back from IndexedDB (revoked when the choice changes).
function useChoicePreviewUrl(choice: MediaChoice | undefined): string {
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (!choice) {
      setUrl('');

      return () => {};
    }

    if (choice.source === 'library') {
      setUrl(findBackground(choice.id)?.url ?? '');

      return () => {};
    }

    if (choice.source === 'url') {
      setUrl(choice.url);

      return () => {};
    }

    let objectUrl = '';
    let cancelled = false;

    browserMediaService
      .getBytes(choice.key)
      .then((bytes) => {
        if (!bytes || cancelled) return;

        objectUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)]));
        setUrl(objectUrl);
      })
      .catch(() => {});

    return () => {
      cancelled = true;

      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [choice]);

  return url;
}

interface ImageOverlayRowProps {
  value: ImageOverlay;
  index: number;
  orientation: EditorState['orientation'];
  onChange: (value: ImageOverlay) => void;
  onRemove: () => void;
}

// One image layer: swap its source (clearing the picker removes the layer) and drag/resize it.
const ImageOverlayRow = ({ value, index, orientation, onChange, onRemove }: ImageOverlayRowProps) => {
  const { t } = useTranslation('admin');
  const previewUrl = useChoicePreviewUrl(value.choice);

  return (
    <OverlayLayer
      index={index}
      label={t('imageOverlay.label')}
      removeLabel={t('imageOverlay.remove')}
      onRemove={onRemove}
    >
      <div className="space-y-3">
        <MediaPicker
          kind="picture"
          value={value.choice}
          onChange={(choice) => {
            if (!choice) {
              onRemove();

              return;
            }

            onChange({ ...value, choice });
          }}
        />
        {previewUrl !== '' && (
          <OverlayPlacement
            orientation={orientation}
            url={previewUrl}
            value={value}
            onChange={(patch) => {
              onChange({ ...value, ...patch });
            }}
          />
        )}
      </div>
    </OverlayLayer>
  );
};

interface ImageOverlayFieldProps {
  value: ImageOverlay[] | undefined;
  orientation: EditorState['orientation'];
  onChange: (value: ImageOverlay[] | undefined) => void;
}

export const ImageOverlayField = ({ value, orientation, onChange }: ImageOverlayFieldProps) => {
  const { t } = useTranslation('admin');
  const images = value ?? [];

  const replaceAt = (index: number, next: ImageOverlay) => {
    onChange(images.map((image, i) => (i === index ? next : image)));
  };

  const removeAt = (index: number) => {
    const next = images.filter((_, i) => i !== index);

    onChange(next.length > 0 ? next : undefined);
  };

  const add = (choice: MediaChoice) => {
    onChange([...images, { id: makeTemplateId(), choice }]);
  };

  return (
    <div>
      {images.map((image, index) => (
        <ImageOverlayRow
          key={image.id}
          value={image}
          index={index}
          orientation={orientation}
          onChange={(next) => {
            replaceAt(index, next);
          }}
          onRemove={() => {
            removeAt(index);
          }}
        />
      ))}
      <div className={images.length > 0 ? 'mt-4 space-y-1.5 border-t border-foreground/10 pt-4' : 'space-y-1.5'}>
        <span className="block text-xs font-semibold uppercase tracking-widest text-gray-400">
          {t('imageOverlay.add')}
        </span>
        <MediaPicker
          kind="picture"
          value={null}
          onChange={(choice) => {
            if (choice) add(choice);
          }}
        />
      </div>
    </div>
  );
};
