import { useState, useId, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTranslation } from 'react-i18next';
import { Upload, Music, Image as ImageIcon, Play, Pause, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { coverGradient } from '@/lib/poster';
import { Button, SegmentedControl } from '@/presentation/components/ui';
import { browserMediaService } from '@/services/browserMediaService';
import { MUSIC_LIBRARY, BACKGROUND_LIBRARY, type MediaCredit } from '@/data/mediaCatalog';
import type { MediaChoice } from './templateEditorModel';

type MediaKind = 'music' | 'picture';
type Tab = 'library' | 'upload' | 'url';

export interface MediaPickerProps {
  kind: MediaKind;
  // single-select (existing + Builder):
  value?: MediaChoice | null;
  onChange?: (choice: MediaChoice | null) => void;
  // multi-select (template editor shortlist):
  multiple?: boolean;
  selectedIds?: string[];
  onToggleId?: (id: string) => void;
  // restrict the library grid to these ids
  allowedIds?: string[];
  // hide the Upload tab when uploads aren't allowed (default: shown)
  allowUpload?: boolean;
}

interface CardProps {
  item: MediaCredit;
  selected: boolean;
  onPick: () => void;
}

const ACCEPT: Record<MediaKind, Record<string, string[]>> = {
  music: { 'audio/*': ['.mp3', '.wav', '.m4a', '.aac', '.ogg'] },
  picture: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
};

function filterByAllowed(items: MediaCredit[], allowedIds: string[] | undefined): MediaCredit[] {
  if (!allowedIds) return items;

  return items.filter((i) => allowedIds.includes(i.id));
}

const noop = () => {};
const pickerShellClass = 'rounded-xl border border-foreground/10 bg-surface-2/40 p-3';

export const MediaPicker = ({
  kind,
  value,
  onChange,
  multiple,
  selectedIds,
  onToggleId,
  allowedIds,
  allowUpload = true,
}: MediaPickerProps) => {
  // Open on the tab matching the current single-select choice (so re-opening a URL/upload choice
  // lands you back where you set it); the multi-select editor only has the library grid.
  const pickInitialTab = (): Tab => {
    if (multiple) return 'library';

    if (value?.source === 'upload') return 'upload';

    if (value?.source === 'url') return 'url';

    return 'library';
  };
  const [tab, setTab] = useState<Tab>(pickInitialTab);

  if (multiple) {
    return (
      <div className={pickerShellClass}>
        <MultiLibraryGrid
          kind={kind}
          selectedIds={selectedIds ?? []}
          onToggleId={onToggleId ?? noop}
          allowedIds={allowedIds}
        />
      </div>
    );
  }

  const choice = value ?? null;
  const handleChange = onChange ?? noop;

  return (
    <div className={pickerShellClass}>
      <TabSwitch tab={tab} setTab={setTab} allowUpload={allowUpload} />
      {tab === 'library' ? (
        <SingleLibraryGrid kind={kind} value={choice} onChange={handleChange} allowedIds={allowedIds} />
      ) : null}
      {tab === 'upload' ? <UploadPane kind={kind} value={choice} onChange={handleChange} /> : null}
      {tab === 'url' ? <UrlPane value={choice} onChange={handleChange} /> : null}
    </div>
  );
};

const TabSwitch = ({ tab, setTab, allowUpload }: { tab: Tab; setTab: (t: Tab) => void; allowUpload: boolean }) => {
  const { t } = useTranslation('admin');
  const tabs: Tab[] = allowUpload ? ['library', 'upload', 'url'] : ['library', 'url'];

  return (
    <SegmentedControl
      ariaLabel={t('media.source')}
      value={tab}
      onChange={(value) => {
        setTab(value as Tab);
      }}
      options={tabs.map((tabId) => ({ value: tabId, label: t(`media.tab.${tabId}`) }))}
      classNames={{ track: 'mb-3', button: 'capitalize' }}
    />
  );
};

interface SingleLibraryGridProps {
  kind: MediaKind;
  value: MediaChoice | null;
  onChange: (choice: MediaChoice | null) => void;
  allowedIds?: string[];
}

const SingleLibraryGrid = ({ kind, value, onChange, allowedIds }: SingleLibraryGridProps) => {
  const { t } = useTranslation('admin');
  const rawItems = kind === 'music' ? MUSIC_LIBRARY : BACKGROUND_LIBRARY;
  const items = filterByAllowed(rawItems, allowedIds);

  if (items.length === 0) {
    return <p className="px-1 py-6 text-center text-sm text-gray-400">{t('media.emptyLibrary')}</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((item) => {
        const selected = value?.source === 'library' && value.id === item.id;
        const pick = () => {
          onChange({ source: 'library', id: item.id });
        };

        if (kind === 'music') {
          return <MusicCard key={item.id} item={item} selected={selected} onPick={pick} />;
        }

        return <PictureCard key={item.id} item={item} selected={selected} onPick={pick} />;
      })}
    </div>
  );
};

interface MultiLibraryGridProps {
  kind: MediaKind;
  selectedIds: string[];
  onToggleId: (id: string) => void;
  allowedIds?: string[];
}

const MultiLibraryGrid = ({ kind, selectedIds, onToggleId, allowedIds }: MultiLibraryGridProps) => {
  const { t } = useTranslation('admin');
  const rawItems = kind === 'music' ? MUSIC_LIBRARY : BACKGROUND_LIBRARY;
  const items = filterByAllowed(rawItems, allowedIds);

  if (items.length === 0) {
    return <p className="px-1 py-6 text-center text-sm text-gray-400">{t('media.emptyMultiLibrary')}</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((item) => {
        const selected = selectedIds.includes(item.id);
        const toggle = () => {
          onToggleId(item.id);
        };

        if (kind === 'music') {
          return <MusicCard key={item.id} item={item} selected={selected} onPick={toggle} />;
        }

        return <PictureCard key={item.id} item={item} selected={selected} onPick={toggle} />;
      })}
    </div>
  );
};

// Only one preview plays at a time across the whole picker: starting a track pauses whichever element
// was playing. The state of each card is driven by its <audio> play/pause events, so a track stopped
// from another card flips its own button back automatically.
let activePreview: HTMLAudioElement | null = null;

const MusicCard = ({ item, selected, onPick }: CardProps) => {
  const { t } = useTranslation('admin');
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  // Release the shared slot if this card owned it when it unmounts (e.g. switching the Library tab).
  useEffect(
    () => () => {
      const audio = audioRef.current;

      if (audio && activePreview === audio) activePreview = null;
    },
    []
  );

  const toggle = () => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (!audio.paused) {
      audio.pause();

      return;
    }

    if (activePreview && activePreview !== audio) activePreview.pause();

    activePreview = audio;
    audio.play().catch(() => {});
  };

  return (
    <div
      className={cn(
        'relative rounded-xl border p-2 transition-all',
        selected
          ? 'border-brand-500 bg-brand-500/5 ring-2 ring-brand-500/30'
          : 'border-foreground/10 hover:border-brand-500/40'
      )}
    >
      <button type="button" onClick={onPick} aria-pressed={selected} className="block w-full text-left">
        <span
          className="relative block aspect-square w-full overflow-hidden rounded-lg"
          style={item.cover ? undefined : { backgroundImage: coverGradient(item.id) }}
        >
          {item.cover ? (
            <img src={item.cover} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <Music className="absolute inset-0 m-auto h-8 w-8 text-white/85" />
          )}
          {selected ? (
            <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-brand-500">
              <Check className="h-3 w-3 text-white" />
            </span>
          ) : null}
        </span>
        <span className="mt-2 block truncate text-sm font-semibold text-foreground">{item.title}</span>
        <span className="block truncate text-xs text-gray-400">{item.author}</span>
      </button>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? t('media.pause', { title: item.title }) : t('media.play', { title: item.title })}
        className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition hover:scale-105 hover:bg-brand-600"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-px" />}
      </button>
      <audio
        ref={audioRef}
        src={item.url}
        preload="none"
        onPlay={() => {
          setPlaying(true);
        }}
        onPause={() => {
          setPlaying(false);
        }}
        onEnded={() => {
          setPlaying(false);

          if (activePreview === audioRef.current) activePreview = null;
        }}
        className="sr-only"
      />
    </div>
  );
};

const PictureCard = ({ item, selected, onPick }: CardProps) => (
  <button
    type="button"
    onClick={onPick}
    aria-pressed={selected}
    className={cn(
      'group relative block overflow-hidden rounded-xl border text-left transition-all',
      selected ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-foreground/10 hover:border-brand-500/40'
    )}
  >
    <span className="block aspect-video w-full overflow-hidden">
      <img
        src={item.url}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover transition-transform group-hover:scale-105"
      />
    </span>
    <span className="block px-2 py-1.5">
      <span className="block truncate text-xs font-semibold text-foreground">{item.title}</span>
      <span className="block truncate text-[0.65rem] text-gray-400">
        {item.author} · {item.license}
      </span>
    </span>
    {selected ? <Check className="absolute right-2 top-2 h-4 w-4 rounded-full bg-brand-500 p-0.5 text-white" /> : null}
  </button>
);

interface UploadPaneProps {
  kind: MediaKind;
  value: MediaChoice | null;
  onChange: (choice: MediaChoice | null) => void;
}

const UploadPane = ({ kind, value, onChange }: UploadPaneProps) => {
  const { t } = useTranslation('admin');
  const inputId = useId();

  const onDrop = (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    const file = files[0];
    browserMediaService
      .save(file, kind)
      .then(({ key }) => {
        onChange({ source: 'upload', key, label: file.name });
      })
      .catch(() => {});
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT[kind],
    maxFiles: 1,
    multiple: false,
  });

  if (value?.source === 'upload') {
    return (
      <SelectedUpload
        kind={kind}
        label={value.label}
        onClear={() => {
          onChange(null);
        }}
      />
    );
  }

  return (
    <div
      {...getRootProps()}
      aria-label={kind === 'music' ? t('media.uploadMusic') : t('media.uploadImage')}
      className={cn(
        'flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors',
        isDragActive ? 'border-brand-500 bg-brand-500/10' : 'border-foreground/15 hover:border-brand-500/50'
      )}
    >
      <input
        {...getInputProps()}
        id={inputId}
        aria-label={kind === 'music' ? t('media.uploadMusic') : t('media.uploadImage')}
      />
      <Upload className="h-6 w-6 text-gray-400" />
      <span className="text-sm text-gray-300">{kind === 'music' ? t('media.dropTrack') : t('media.dropImage')}</span>
      <span className="text-xs text-gray-500">
        {kind === 'music' ? t('media.musicFormats') : t('media.imageFormats')}
      </span>
    </div>
  );
};

// Paste a direct asset URL (image/audio hosted elsewhere). The engine fetches it at compile time,
// so no copy is stored on device — distinct from Upload. Clearing the field drops the choice.
const UrlPane = ({
  value,
  onChange,
}: {
  value: MediaChoice | null;
  onChange: (choice: MediaChoice | null) => void;
}) => {
  const { t } = useTranslation('admin');
  const inputId = useId();
  const url = value?.source === 'url' ? value.url : '';

  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">
        {t('media.urlLabel')}
      </label>
      <input
        id={inputId}
        type="url"
        inputMode="url"
        value={url}
        placeholder={t('media.urlPlaceholder')}
        onChange={(e) => {
          const next = e.target.value.trim();
          onChange(next === '' ? null : { source: 'url', url: next });
        }}
        className="w-full rounded-lg border border-foreground/10 bg-surface px-3 py-2 text-sm text-foreground placeholder:text-gray-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
      />
      <span className="mt-1 block text-xs text-gray-500">{t('media.urlHint')}</span>
    </div>
  );
};

const SelectedUpload = ({ kind, label, onClear }: { kind: MediaKind; label: string; onClear: () => void }) => {
  const { t } = useTranslation('admin');

  return (
    <div className="flex items-center gap-3 rounded-lg border border-brand-500/30 bg-brand-500/10 p-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-500/20 text-brand-300">
        {kind === 'music' ? <Music className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{label}</span>
        <span className="block text-xs text-gray-400">{t('media.uploaded')}</span>
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={onClear}
        aria-label={t('media.removeUpload')}
        className="text-gray-400"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};
