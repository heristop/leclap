// Canvas-free animation overlay pieces shared by AnimationGallery (which adds the drag canvas) and the
// canvas-less PlacementControls inspector: AnimationSource = the Library / Upload / Url tabbed source picker
// (the Library tab is AnimationLibraryPicker: engine primitives first, the APNG samples last),
// and AnimationPlayback = playback extent (forever / loops / seconds) + start offset + keep-last-frame.
// These are the single source for the animation source/playback UI so both consumers reuse them.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMediaDrop, type AcceptSpec, type Rejection } from '@/lib/upload';
import { Upload, X } from '@/presentation/components/icons';
import { cn } from '@/lib/utils';
import { Button, Checkbox, SegmentedControl } from '@/presentation/components/ui';
import { NumberField } from '@/presentation/components/ui/NumberField';
import { findAnimationByUrl, findSampleCard, type AnimationAsset, type PickerCard } from '@/data/mediaCatalog';
import {
  animationDefaultsForUrl,
  type AnimationEffectPreset,
  type AnimationOverlay,
  type EngineLibraryEntry,
} from '../templateEditorModel';
import { PREVIEW_BG_CLASS } from './animationOverlay';
import { AnimationMedia } from './AnimationMedia';
import { AnimationLibraryPicker } from './AnimationLibraryPicker';

type Tab = 'library' | 'upload' | 'url';

// Both concrete types (no wildcard), so the picker advertises the extensions alongside them.
const ANIMATION_ACCEPT: AcceptSpec = [
  { mime: 'image/apng', extensions: ['.apng'] },
  { mime: 'video/webm', extensions: ['.webm'] },
];

// The upload preview sits on the transparency checker so a transparent/white overlay stays readable
// (library cards show their engine-rendered thumbnails on their own dark stage instead); the placement
// panel below (when present) carries its own switchable backdrop.
export const CHECKER = PREVIEW_BG_CLASS.checker;

// Open on the tab matching the current value so re-opening lands you back where you set it: a library
// match → Library, a data: URL → Upload, an http(s) URL not in the library → Url.
export const pickInitialTab = (value: AnimationOverlay | undefined): Tab => {
  if (!value) return 'library';

  if (findAnimationByUrl(value.url)) return 'library';

  if (value.url.startsWith('data:')) return 'upload';

  if (/^https?:/i.test(value.url)) return 'url';

  return 'library';
};

interface AnimationSourceProps {
  value: AnimationOverlay | undefined;
  onChange: (value?: AnimationOverlay) => void;
  /** Override the sample list with a curated one (config-driven); defaults to the bundled samples. */
  library?: AnimationAsset[];
  /** Inserts an engine primitive in place of this overlay (a section host); absent = samples only. */
  onPickEngine?: (entry: EngineLibraryEntry) => void;
  /** Inserts a two-part recipe in place of this overlay. */
  onPickRecipe?: (preset: AnimationEffectPreset) => void;
}

// A curated asset list as sample cards (the bundled ones keep their thumbnails).
const curatedSamples = (library: AnimationAsset[]): PickerCard[] =>
  library.map(
    (asset) =>
      findSampleCard(asset.url) ?? {
        key: `sample:${asset.id}`,
        id: asset.id,
        group: 'samples',
        labelKey: `animation.library.${asset.id}`,
        fallbackLabel: asset.label,
        sample: asset,
      }
  );

// The Library / Upload / Url tabbed source picker (no canvas, no placement).
export const AnimationSource = ({ value, onChange, library, onPickEngine, onPickRecipe }: AnimationSourceProps) => {
  const [tab, setTab] = useState<Tab>(() => pickInitialTab(value));

  return (
    <div>
      <AnimationTabs tab={tab} setTab={setTab} />
      {tab === 'library' ? (
        <AnimationLibraryPicker
          selectedUrl={value?.url}
          samples={library ? curatedSamples(library) : undefined}
          onPickEngine={onPickEngine}
          onPickRecipe={onPickRecipe}
          onPickSample={(card) => {
            const asset = card.sample;

            if (asset) onChange({ url: asset.url, label: asset.label, ...animationDefaultsForUrl(asset.url) });
          }}
        />
      ) : null}
      {tab === 'upload' ? <AnimationUploadPane value={value} onChange={onChange} /> : null}
      {tab === 'url' ? <AnimationUrlPane value={value} onChange={onChange} /> : null}
    </div>
  );
};

type PlaybackMode = 'forever' | 'loops' | 'seconds';

// Derive the active mode from which extent field is set; loop:false (play once) reads as a 1-loop count.
const playbackModeOf = (v: AnimationOverlay): PlaybackMode => {
  if (v.duration !== undefined) return 'seconds';

  if (v.loops !== undefined || v.loop === false) return 'loops';

  return 'forever';
};

interface PlaybackProps {
  value: AnimationOverlay;
  patch: (over: Partial<AnimationOverlay>) => void;
}

// Playback extent + start offset + keep-last-frame. The 3-way control sets exactly one extent (clearing the
// others) so the descriptor stays unambiguous; "Start" delays the overlay (0 = from the beginning).
export const AnimationPlayback = ({ value, patch }: PlaybackProps) => {
  const { t } = useTranslation('admin');
  const mode = playbackModeOf(value);

  const setMode = (next: PlaybackMode) => {
    if (next === 'forever') patch({ loop: true, loops: undefined, duration: undefined });

    if (next === 'loops') patch({ loops: value.loops ?? 1, loop: undefined, duration: undefined });

    if (next === 'seconds') patch({ duration: value.duration ?? 3, loop: undefined, loops: undefined });
  };

  return (
    <div className="space-y-2 pt-0.5">
      <SegmentedControl
        ariaLabel={t('animation.playback')}
        value={mode}
        onChange={(next) => {
          setMode(next as PlaybackMode);
        }}
        options={[
          { value: 'forever', label: t('animation.forever') },
          { value: 'loops', label: t('animation.loopsTab') },
          { value: 'seconds', label: t('animation.secondsTab') },
        ]}
      />
      {mode === 'loops' ? (
        <NumberRow
          label={t('animation.loopsLabel')}
          value={value.loops ?? 1}
          min={1}
          onChange={(n) => {
            patch({ loops: Math.max(1, Math.round(n)) });
          }}
        />
      ) : null}
      {mode === 'seconds' ? (
        <NumberRow
          label={t('animation.secondsLabel', { count: value.duration ?? 3 })}
          value={value.duration ?? 3}
          min={0.1}
          step={0.5}
          unit="s"
          onChange={(n) => {
            patch({ duration: n });
          }}
        />
      ) : null}
      <NumberRow
        label={t('animation.startLabel')}
        value={value.start ?? 0}
        min={0}
        step={0.5}
        unit="s"
        onChange={(n) => {
          patch({ start: n > 0 ? n : undefined });
        }}
      />
      <label className="flex w-fit cursor-pointer select-none items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
        <Checkbox
          checked={value.persistent ?? true}
          onCheckedChange={(c) => {
            patch({ persistent: c === true });
          }}
        />
        {t('animation.keepLastFrame')}
      </label>
    </div>
  );
};

// Shared label + compact number input row; also reused by ImageOverlayField for the image show window.
export const NumberRow = ({
  label,
  value,
  min,
  step = 1,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</span>
    <NumberField
      aria-label={label}
      value={value}
      min={min}
      step={step}
      unit={unit}
      compact
      className="w-28"
      onChange={onChange}
    />
  </div>
);

const AnimationTabs = ({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) => {
  const { t } = useTranslation('admin');
  const tabs: Tab[] = ['library', 'upload', 'url'];

  return (
    <SegmentedControl
      ariaLabel={t('media.source')}
      value={tab}
      onChange={(next) => {
        setTab(next as Tab);
      }}
      options={tabs.map((tabId) => ({ value: tabId, label: t(`media.tab.${tabId}`) }))}
      classNames={{ track: 'mb-3', button: 'capitalize' }}
    />
  );
};

interface PaneProps {
  value: AnimationOverlay | undefined;
  onChange: (value?: AnimationOverlay) => void;
}

const AnimationUploadPane = ({ value, onChange }: PaneProps) => {
  const { t } = useTranslation('admin');
  const [invalid, setInvalid] = useState(false);

  // ANIMATION_ACCEPT is the only type guard: useMediaDrop validates against it and hands the
  // failures back here, so a dropped .gif reports `animation.invalidType` instead of vanishing.
  const onDrop = (files: File[], rejections: Rejection[]) => {
    setInvalid(rejections.length > 0);

    if (files.length === 0) {
      return;
    }

    const file = files[0];
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onChange({ url: reader.result, label: file.name });
      }
    };
    reader.readAsDataURL(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useMediaDrop({
    onDrop,
    accept: ANIMATION_ACCEPT,
    remaining: 1,
    multiple: false,
  });

  // A data: URL is an uploaded animation (library/url assets resolve elsewhere) — show its live preview.
  const uploaded = value?.url.startsWith('data:') ? value : undefined;

  if (uploaded) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-brand-500/30 bg-brand-500/10 p-3">
        <span className={cn('grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg', CHECKER)}>
          <AnimationMedia url={uploaded.url} className="h-full w-full object-contain" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{uploaded.label}</span>
          <span className="block text-xs text-gray-400">{t('animation.uploaded')}</span>
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            onChange();
          }}
          aria-label={t('animation.removeUpload')}
          className="text-gray-400"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div
        {...getRootProps()}
        aria-label={t('animation.upload')}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors',
          isDragActive ? 'border-brand-500 bg-brand-500/10' : 'border-foreground/15 hover:border-brand-500/50'
        )}
      >
        <input {...getInputProps()} aria-label={t('animation.upload')} />
        <Upload className="h-6 w-6 text-gray-400" />
        <span className="text-sm text-gray-300">{t('animation.dropAnimation')}</span>
        <span className="text-xs text-gray-500">{t('animation.animationFormats')}</span>
      </div>
      {invalid ? <p className="mt-1 text-[0.7rem] text-red-500">{t('animation.invalidType')}</p> : null}
    </div>
  );
};

// Paste a direct animation URL (hosted elsewhere); the engine fetches it at compile time. Clearing the
// field drops the choice. The label is derived from the URL's filename.
const AnimationUrlPane = ({ value, onChange }: PaneProps) => {
  const { t } = useTranslation('admin');
  const url = value && !value.url.startsWith('data:') && !findAnimationByUrl(value.url) ? value.url : '';

  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">
        {t('media.urlLabel')}
      </label>
      <input
        type="url"
        inputMode="url"
        value={url}
        placeholder={t('media.urlPlaceholder')}
        onChange={(e) => {
          const next = e.target.value.trim();

          if (next === '') {
            onChange();

            return;
          }

          onChange({ url: next, label: next.split('/').pop() ?? next });
        }}
        className="field-focus-gradient w-full rounded-lg border border-foreground/10 bg-surface px-3 py-2 text-sm text-foreground placeholder:text-gray-500 transition-colors [--field-fill:var(--color-surface)] focus:outline-none"
      />
      <span className="mt-1 block text-xs text-gray-500">{t('media.urlHint')}</span>
    </div>
  );
};
