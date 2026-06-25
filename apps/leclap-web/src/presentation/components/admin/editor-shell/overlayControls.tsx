// The styling controls for a single selected text overlay, lifted out of the legacy OverlayCanvas:
// font, size, insert-variable, delete, color, and the optional background box. No canvas/preview here
// — these render in the left OverlayInspector and patch the overlay through `onPatch`.
import { useId, useState } from 'react';
import type { TFunction } from 'i18next';
import { Trash2, Type } from '@/presentation/components/icons';
import { ChevronDownIcon } from '@/presentation/components/icons/chevron-down';
import { useIconHover } from '@/presentation/components/icons/useIconHover';
import { FONTS } from '@leclap/creative-kit/fonts';
import { rangeFill } from '../editor/controls';
import { RevealControl } from '../editor/RevealControl';
import { ExitControl } from '../editor/ExitControl';
import {
  Button,
  Checkbox,
  ColorPicker,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui';
import type { TextOverlay } from '../templateEditorModel';

interface SelectedControlsProps {
  overlay: TextOverlay;
  t: TFunction<'admin'>;
  variables: string[];
  onPatch: (patch: Partial<TextOverlay>) => void;
  onInsertVariable: (name: string) => void;
  onDelete: () => void;
}

export const SelectedControls = ({
  overlay,
  t,
  variables,
  onPatch,
  onInsertVariable,
  onDelete,
}: SelectedControlsProps) => {
  const sizeId = useId();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <FontSelect
          value={overlay.font}
          t={t}
          onChange={(font) => {
            onPatch({ font });
          }}
        />
        <div className="min-w-[10rem] flex-1">
          <label htmlFor={sizeId} className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">
            {t('overlay.size', { size: overlay.fontsize })}
          </label>
          <input
            id={sizeId}
            type="range"
            min={8}
            max={300}
            value={overlay.fontsize}
            onChange={(e) => {
              onPatch({ fontsize: Number(e.target.value) });
            }}
            style={rangeFill(overlay.fontsize, 8, 300)}
            className="studio-range"
          />
        </div>
        <VariableMenu variables={variables} t={t} onInsert={onInsertVariable} />
        <button
          type="button"
          onClick={onDelete}
          aria-label={t('overlay.deleteText')}
          className="tap rounded-lg p-2 text-gray-500 transition-colors hover:bg-foreground/5 hover:text-[var(--color-error)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error)]/40 active:scale-90"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">
            {t('overlay.color')}
          </label>
          <ColorPicker
            aria-label={t('overlay.textColor')}
            value={overlay.fontcolor}
            onChange={(fontcolor) => {
              onPatch({ fontcolor });
            }}
          />
        </div>
        <BoxControls overlay={overlay} t={t} onPatch={onPatch} />
      </div>
      {/* Animated entrance (rise/slide/fade) for the text — same reveal vocabulary as the other layers. */}
      <RevealControl
        reveal={overlay.reveal}
        onChange={(reveal) => {
          onPatch({ reveal });
        }}
      />
      {/* Animated exit after a delay, timed against the section duration. */}
      <ExitControl
        exit={overlay.exit}
        onChange={(exit) => {
          onPatch({ exit });
        }}
      />
    </div>
  );
};

// The "Box" toggle plus its color picker and opacity slider (revealed only when the box is on).
const BoxControls = ({
  overlay,
  t,
  onPatch,
}: {
  overlay: TextOverlay;
  t: TFunction<'admin'>;
  onPatch: (patch: Partial<TextOverlay>) => void;
}) => {
  const opacityId = useId();

  return (
    <div className="space-y-2">
      <label className="flex w-fit cursor-pointer select-none items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
        <Checkbox
          checked={overlay.box}
          onCheckedChange={(c) => {
            onPatch({ box: c === true });
          }}
        />{' '}
        {t('overlay.box')}
      </label>
      {overlay.box && (
        <div className="space-y-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">
              {t('overlay.boxColor')}
            </label>
            <ColorPicker
              aria-label={t('overlay.boxColor')}
              value={overlay.boxcolor}
              onChange={(boxcolor) => {
                onPatch({ boxcolor });
              }}
            />
          </div>
          <div>
            <label
              htmlFor={opacityId}
              className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400"
            >
              {t('overlay.boxOpacity', { percent: Math.round(overlay.boxOpacity * 100) })}
            </label>
            <input
              id={opacityId}
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={overlay.boxOpacity}
              onChange={(e) => {
                onPatch({ boxOpacity: Number(e.target.value) });
              }}
              style={rangeFill(overlay.boxOpacity, 0, 1)}
              className="studio-range"
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Design-system font picker over the curated FONTS catalog. Each option previews in its own face.
const FontSelect = ({
  value,
  t,
  onChange,
}: {
  value: string;
  t: TFunction<'admin'>;
  onChange: (id: string) => void;
}) => (
  <div className="min-w-[9rem]">
    <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">
      {t('overlay.font')}
    </span>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={t('overlay.font')} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {FONTS.map((font) => (
          <SelectItem key={font.id} value={font.id} style={{ fontFamily: font.cssFamily }}>
            {font.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

// "Insert variable ▾" dropdown. Lists the available variable names; choosing one inserts
// `{{ name }}`. Disabled when there are no variables.
const VariableMenu = ({
  variables,
  t,
  onInsert,
}: {
  variables: string[];
  t: TFunction<'admin'>;
  onInsert: (name: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const disabled = variables.length === 0;
  const { ref: chevronRef, hoverProps: chevronHoverProps } = useIconHover();

  if (disabled) {
    return (
      <Button type="button" variant="secondary" size="sm" disabled title={t('overlay.insertVariableHint')}>
        {t('overlay.insertVariable')} <ChevronDownIcon size={14} />
      </Button>
    );
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
        }}
        onBlur={() => {
          setOpen(false);
        }}
        {...chevronHoverProps}
      >
        {t('overlay.insertVariable')} <ChevronDownIcon ref={chevronRef} size={14} />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute z-10 mt-1 max-h-48 min-w-[10rem] overflow-auto rounded-xl border border-divider bg-surface p-1 shadow-[var(--shadow-lg)]"
        >
          {variables.map((name) => (
            <button
              key={name}
              type="button"
              role="menuitem"
              onMouseDown={(e) => {
                e.preventDefault();
                onInsert(name);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-foreground hover:bg-brand-500/15"
            >
              <Type className="h-3.5 w-3.5 text-gray-400" /> {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
