// Animated-overlay picker for a visual section, mirroring the image MediaPicker: a Library / Upload / Url
// tabbed submenu over the same SegmentedControl pill. Library shows every bundled animation as a live
// preview, Upload drops a custom .apng/.webm (kept inline as a data URL), Url pastes a direct link. When an
// overlay is selected the shared OverlayPlacement panel exposes Position + Scale + Opacity + Rotation and
// the drag canvas (the same controls as the image overlay); only the playback-only loop + keep-last-frame checkboxes
// stay animation-specific here. Writes section.animation; the library list is dynamic (see mediaCatalog)
// and a caller may override it. Unlike the image picker, animations stay url-based — no MediaChoice model.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Checkbox, SegmentedControl } from '@/presentation/components/ui';
import { ANIMATION_LIBRARY, findAnimationByUrl, type AnimationAsset } from '@/data/mediaCatalog';
import type { AnimationOverlay, Orientation } from '../templateEditorModel';
import { PREVIEW_BG_CLASS } from './animationOverlay';
import { OverlayPlacement } from './OverlayPlacement';
import { AnimationMedia } from './AnimationMedia';

type Tab = 'library' | 'upload' | 'url';

// Library cards + upload preview sit on the transparency checker so transparent/white overlays stay
// readable; the placement panel below carries its own switchable backdrop.
const CHECKER = PREVIEW_BG_CLASS.checker;

interface AnimationGalleryProps {
  value: AnimationOverlay | undefined;
  orientation: Orientation;
  onChange: (value?: AnimationOverlay) => void;
  /** Override the dynamic library with a curated list (config-driven); defaults to all bundled animations. */
  library?: AnimationAsset[];
}

// Open on the tab matching the current value so re-opening lands you back where you set it: a library
// match → Library, a data: URL → Upload, an http(s) URL not in the library → Url.
const pickInitialTab = (value: AnimationOverlay | undefined): Tab => {
  if (!value) return 'library';

  if (findAnimationByUrl(value.url)) return 'library';

  if (value.url.startsWith('data:')) return 'upload';

  if (/^https?:/i.test(value.url)) return 'url';

  return 'library';
};

export const AnimationGallery = ({
  value,
  orientation,
  onChange,
  library = ANIMATION_LIBRARY,
}: AnimationGalleryProps) => {
  const { t } = useTranslation('admin');
  const [tab, setTab] = useState<Tab>(() => pickInitialTab(value));

  const patch = (over: Partial<AnimationOverlay>) => {
    if (value) onChange({ ...value, ...over });
  };

  return (
    <div className="rounded-xl border border-foreground/10 bg-surface-2/40 p-3">
      <AnimationTabs tab={tab} setTab={setTab} />
      {tab === 'library' ? <AnimationLibraryGrid value={value} library={library} onChange={onChange} /> : null}
      {tab === 'upload' ? <AnimationUploadPane value={value} onChange={onChange} /> : null}
      {tab === 'url' ? <AnimationUrlPane value={value} onChange={onChange} /> : null}

      {value ? (
        <div className="mt-3 space-y-2">
          <OverlayPlacement orientation={orientation} url={value.url} value={value} onChange={patch} />
          {/* Playback-only — these don't apply to a still image, so they stay out of OverlayPlacement. */}
          <PlaybackControls value={value} patch={patch} />
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
      ) : null}
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

// Playback extent + start offset. The 3-way control sets exactly one extent (clearing the others) so the
// descriptor stays unambiguous; "Start" delays the overlay (0 = from the beginning).
const PlaybackControls = ({
  value,
  patch,
}: {
  value: AnimationOverlay;
  patch: (over: Partial<AnimationOverlay>) => void;
}) => {
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
          label={t('animation.secondsLabel')}
          value={value.duration ?? 3}
          min={0.1}
          step={0.5}
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
        onChange={(n) => {
          patch({ start: n > 0 ? n : undefined });
        }}
      />
    </div>
  );
};

const NumberRow = ({
  label,
  value,
  min,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  step?: number;
  onChange: (value: number) => void;
}) => (
  <label className="flex items-center justify-between gap-2">
    <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</span>
    <input
      type="number"
      min={min}
      step={step}
      value={value}
      onChange={(e) => {
        onChange(Number(e.target.value));
      }}
      className="w-24 rounded-lg border border-foreground/15 bg-surface-inset px-2 py-1 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
    />
  </label>
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

interface LibraryGridProps {
  value: AnimationOverlay | undefined;
  library: AnimationAsset[];
  onChange: (value?: AnimationOverlay) => void;
}

const AnimationLibraryGrid = ({ value, library, onChange }: LibraryGridProps) => (
  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup">
    {library.map((animation) => {
      const selected = value?.url === animation.url;

      return (
        <button
          key={animation.id}
          type="button"
          role="radio"
          aria-checked={selected}
          onClick={() => {
            onChange({ url: animation.url, label: animation.label });
          }}
          className={cn(
            'group relative block overflow-hidden rounded-xl border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
            selected ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-foreground/10 hover:border-brand-500/40'
          )}
        >
          <span className={cn('block aspect-video w-full overflow-hidden', CHECKER)}>
            <AnimationMedia url={animation.url} className="h-full w-full object-contain" />
          </span>
          <span className="block truncate px-2 py-1.5 text-[0.65rem] font-semibold text-foreground">
            {animation.label}
          </span>
          {selected ? (
            <Check className="absolute right-2 top-2 h-4 w-4 rounded-full bg-brand-500 p-0.5 text-white" />
          ) : null}
        </button>
      );
    })}
  </div>
);

interface PaneProps {
  value: AnimationOverlay | undefined;
  onChange: (value?: AnimationOverlay) => void;
}

// Reject anything that isn't an .apng / .webm, mirroring the original file-input guard.
const isAnimationFile = (file: File): boolean =>
  /\.(apng|webm)$/i.test(file.name) || file.type === 'image/apng' || file.type === 'video/webm';

const AnimationUploadPane = ({ value, onChange }: PaneProps) => {
  const { t } = useTranslation('admin');
  const [invalid, setInvalid] = useState(false);

  const onDrop = (files: File[]) => {
    setInvalid(false);

    if (files.length === 0) {
      return;
    }

    const file = files[0];

    if (!isAnimationFile(file)) {
      setInvalid(true);

      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onChange({ url: reader.result, label: file.name });
      }
    };
    reader.readAsDataURL(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/apng': ['.apng'], 'video/webm': ['.webm'] },
    maxFiles: 1,
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
        className="w-full rounded-lg border border-foreground/10 bg-surface px-3 py-2 text-sm text-foreground placeholder:text-gray-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
      />
      <span className="mt-1 block text-xs text-gray-500">{t('media.urlHint')}</span>
    </div>
  );
};
