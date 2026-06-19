// Shared placement panel for a draggable overlay (animation or still image). Renders the controls both
// kinds share: a switchable preview background, the drag/resize/rotate AnimationFrameCanvas, and a
// controls column with Position (X/Y) + Scale (W/H) numeric pairs, Opacity + Rotation sliders, and a
// reset-position/scale button. The preview-bg toggle state lives here. Playback-only controls (loop /
// keep-last-frame) stay with the animation caller — they don't apply to a still image. The owning
// PairField / AxisInput / PreviewBgToggle helpers live here too, so AnimationGallery + ImageOverlayField
// reuse them instead of each carrying a copy.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { RotateCcw } from '@/presentation/components/icons';
import { cn } from '@/lib/utils';
import type { Orientation } from '../templateEditorModel';
import { PREVIEW_BG_CLASS, parsePair, formatPair, type PreviewBg } from './animationOverlay';
import { AnimationFrameCanvas } from './AnimationFrameCanvas';
import { RangeSlider } from './controls';

// The subset of overlay fields the shared panel reads/writes. Both AnimationOverlay and ImageOverlay
// carry these (string "x:y" position, string "w:h" scale, 0–1 opacity, degrees rotation), all optional.
export interface OverlayPlacementValue {
  position?: string;
  scale?: string;
  opacity?: number;
  rotation?: number;
}

interface OverlayPlacementProps {
  orientation: Orientation;
  /** Resolved, previewable URL for the canvas (animation file or resolved image source). */
  url: string;
  value: OverlayPlacementValue;
  onChange: (patch: OverlayPlacementValue) => void;
}

// Canvas + Position/Scale/Opacity/Rotation + reset, with its own preview-bg toggle above the canvas.
export const OverlayPlacement = ({ orientation, url, value, onChange }: OverlayPlacementProps) => {
  const { t } = useTranslation('admin');
  const [previewBg, setPreviewBg] = useState<PreviewBg>('checker');

  return (
    <div>
      <div className="mb-1.5 flex justify-end">
        <PreviewBgToggle value={previewBg} onChange={setPreviewBg} t={t} />
      </div>

      <div className="flex flex-wrap items-start gap-3">
        <div>
          <AnimationFrameCanvas
            orientation={orientation}
            bg={previewBg}
            url={url}
            position={value.position}
            scale={value.scale}
            rotation={value.rotation}
            onChange={onChange}
          />
          <p className="mt-1 text-center text-[0.6rem] text-gray-400">{t('animation.dragHint')}</p>
        </div>

        <div className="min-w-[150px] flex-1 space-y-2">
          <PairField
            label={t('animation.position')}
            hint={t('animation.positionHint')}
            value={value.position}
            aLabel="X"
            bLabel="Y"
            placeholder="0"
            onChange={(position) => {
              onChange({ position });
            }}
          />
          <PairField
            label={t('animation.scale')}
            hint={t('animation.scaleHint')}
            value={value.scale}
            aLabel="W"
            bLabel="H"
            placeholder="auto"
            onChange={(scale) => {
              onChange({ scale });
            }}
          />
          <RangeSlider
            label={t('animation.opacity')}
            value={value.opacity ?? 1}
            min={0}
            max={1}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            resetTo={1}
            onChange={(opacity) => {
              onChange({ opacity });
            }}
          />
          <RangeSlider
            label={t('animation.rotation')}
            value={value.rotation ?? 0}
            min={-180}
            max={180}
            step={1}
            format={(v) => `${Math.round(v)}°`}
            resetTo={0}
            onChange={(rotation) => {
              onChange({ rotation });
            }}
          />
          {(value.position ?? value.scale) ? (
            <button
              type="button"
              onClick={() => {
                onChange({ position: undefined, scale: undefined });
              }}
              className="tap inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[0.65rem] font-semibold text-brand-600 transition-colors hover:bg-brand-500/10 dark:text-brand-300"
            >
              <RotateCcw className="size-3" aria-hidden />
              {t('animation.reset')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

// Three-way preview background switch (checker / dark / light) so transparent or white overlays stay
// readable on the canvas. Owned here because the placement panel owns the preview-bg state.
export const PreviewBgToggle = ({
  value,
  onChange,
  t,
}: {
  value: PreviewBg;
  onChange: (bg: PreviewBg) => void;
  t: TFunction<'admin'>;
}) => {
  const options: Array<{ key: PreviewBg; title: string }> = [
    { key: 'checker', title: t('animation.bgChecker') },
    { key: 'dark', title: t('animation.bgDark') },
    { key: 'light', title: t('animation.bgLight') },
  ];

  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label={t('animation.previewBg')}>
      {options.map(({ key, title }) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          title={title}
          onClick={() => {
            onChange(key);
          }}
          className={cn(
            'size-5 rounded-full border transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
            PREVIEW_BG_CLASS[key],
            value === key ? 'border-brand-500 ring-1 ring-brand-500/40' : 'border-foreground/20'
          )}
        />
      ))}
    </div>
  );
};

interface PairFieldProps {
  label: string;
  hint: string;
  value: string | undefined;
  aLabel: string;
  bLabel: string;
  placeholder: string;
  onChange: (value: string | undefined) => void;
}

// Two numeric inputs that read/write a single "a:b" descriptor pair (Position X/Y or Scale W/H).
const PairField = ({ label, hint, value, aLabel, bLabel, placeholder, onChange }: PairFieldProps) => {
  const [a, b] = parsePair(value);

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-gray-400">{label}</span>
        <span className="truncate text-[0.6rem] text-gray-400">{hint}</span>
      </div>
      <div className="flex gap-1.5">
        <AxisInput
          axis={aLabel}
          value={a}
          placeholder={placeholder}
          onChange={(v) => {
            onChange(formatPair(v, b));
          }}
        />
        <AxisInput
          axis={bLabel}
          value={b}
          placeholder={placeholder}
          onChange={(v) => {
            onChange(formatPair(a, v));
          }}
        />
      </div>
    </div>
  );
};

const AxisInput = ({
  axis,
  value,
  placeholder,
  onChange,
}: {
  axis: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) => (
  <label className="flex min-w-0 flex-1 items-center gap-1 rounded-lg border border-foreground/10 bg-foreground/5 px-2 py-1 focus-within:border-brand-500/50">
    <span className="text-[0.65rem] font-semibold text-gray-400">{axis}</span>
    <input
      inputMode="numeric"
      value={value}
      placeholder={placeholder}
      aria-label={axis}
      onChange={(e) => {
        onChange(e.target.value.replace(/[^\d-]/g, ''));
      }}
      className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-gray-400"
    />
  </label>
);
