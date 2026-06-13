import { useState, useId, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTranslation } from 'react-i18next';
import { Upload, Music, Image as ImageIcon, Play, Pause, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/presentation/components/ui';
import { browserMediaService } from '@/services/browserMediaService';
import { MUSIC_LIBRARY, BACKGROUND_LIBRARY, type MediaCredit } from '@/data/mediaCatalog';
import type { MediaChoice } from './templateEditorModel';

type MediaKind = 'music' | 'picture';
type Tab = 'library' | 'upload';

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

// Deterministic two-stop gradient per track, so a track without cover art still
// gets a stable, distinct "cover" (Spotify/Deezer-style) instead of a flat block.
function coverGradient(seed: string): string {
  let hash = 7;

  for (const char of seed) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 360;
  }

  const second = (hash + 48) % 360;

  return `linear-gradient(135deg, oklch(0.62 0.19 ${hash}), oklch(0.5 0.21 ${second}))`;
}

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
  const initialTab: Tab = !multiple && value?.source === 'upload' ? 'upload' : 'library';
  const [tab, setTab] = useState<Tab>(initialTab);

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
    </div>
  );
};

const TabSwitch = ({ tab, setTab, allowUpload }: { tab: Tab; setTab: (t: Tab) => void; allowUpload: boolean }) => {
  const { t } = useTranslation('admin');
  const tabs = allowUpload ? (['library', 'upload'] as const) : (['library'] as const);

  return (
    <div
      role="tablist"
      aria-label={t('media.source')}
      className="mb-3 inline-flex rounded-lg bg-foreground/5 p-0.5 text-sm"
    >
      {tabs.map((tabId) => (
        <button
          key={tabId}
          type="button"
          role="tab"
          aria-selected={tab === tabId}
          onClick={() => {
            setTab(tabId);
          }}
          className={cn(
            'rounded-md px-3 py-1.5 font-medium capitalize transition-colors',
            tab === tabId ? 'bg-surface text-foreground shadow-sm' : 'text-gray-400 hover:text-foreground'
          )}
        >
          {t(`media.tab.${tabId}`)}
        </button>
      ))}
    </div>
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

const MusicCard = ({ item, selected, onPick }: CardProps) => {
  const { t } = useTranslation('admin');
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (playing) {
      audio.pause();
      setPlaying(false);

      return;
    }

    audio.play().catch(() => {});
    setPlaying(true);
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
        onEnded={() => {
          setPlaying(false);
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
