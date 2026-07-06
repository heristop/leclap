// Whole-video TEXT overlays (descriptor global.overlays) — a brand watermark authored once and drawn
// on every section, the text sibling of WholeVideoAnimations. A small list editor: each row is a text
// line with a position anchor, a colour and an entrance, plus an "Advanced styling" disclosure for the
// font/size/opacity overrides and the per-scene targeting the engine already honours. Empty rows are
// dropped on emit.
import { useTranslation } from 'react-i18next';
import { FONTS } from '@leclap/creative-kit/fonts';
import { cn } from '@/lib/utils';
import type { EditorState, GlobalTextOverlay } from '../templateEditorModel';
import {
  Button,
  ColorPicker,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui';
import { NumberField } from '@/presentation/components/ui/NumberField';
import { Check, Plus, X } from '@/presentation/components/icons';
import { RangeSlider } from './controls';
import { RevealControl } from './RevealControl';
import { SectionDisclosure } from './SectionDisclosure';
import { TextEffectControl } from './TextEffectControl';
import { VariableTextField } from './VariableTextField';
import { EDITOR_INPUT_CLASS } from './editorStyles';
import { overlaySectionChoices, toggleOverlaySection } from './global-overlay-sections';
import { overlayDisplayText, withOverlayText } from './global-overlay-text';

type Position = NonNullable<GlobalTextOverlay['position']>;

// The 7 engine anchors laid out as a 3×3 pad (no middle-left/right anchors exist), so placing the
// watermark is one tap on a spatial map instead of a two-step select.
const POSITION_GRID: ReadonlyArray<Position | null> = [
  'top-left',
  'top',
  'top-right',
  null,
  'center',
  null,
  'bottom-left',
  'bottom',
  'bottom-right',
];

const DEFAULT_COLOR = '#ffffff';
// Mirrors the engine's fallback (round(h * 0.03) at 1080p landscape) so the untouched field shows
// what actually renders.
const DEFAULT_SIZE = 32;
const DEFAULT_OPACITY = 1;

interface GlobalOverlaysFieldProps {
  overlays: GlobalTextOverlay[];
  variables: string[];
  sectionNames: string[];
  patch: (p: Partial<EditorState>) => void;
}

export const GlobalOverlaysField = ({ overlays, variables, sectionNames, patch }: GlobalOverlaysFieldProps) => {
  const { t } = useTranslation('admin');

  const replace = (index: number, next: GlobalTextOverlay) => {
    patch({ globalOverlays: overlays.map((overlay, i) => (i === index ? next : overlay)) });
  };

  const remove = (index: number) => {
    patch({ globalOverlays: overlays.filter((_, i) => i !== index) });
  };

  const add = () => {
    patch({ globalOverlays: [...overlays, { text: { en: '' }, position: 'top-right' }] });
  };

  // Collapsed summary: how many watermark lines are configured (the disclosure's at-a-glance state).
  const summary =
    overlays.length === 0 ? t('summaryChip.none') : t('globalOverlay.count', { count: overlays.length });

  return (
    <SectionDisclosure label={t('globalOverlay.label')} summary={summary}>
      <p className="text-xs text-gray-500 dark:text-gray-400">{t('globalOverlay.hint')}</p>

      <div className="space-y-3">
        {overlays.map((overlay, index) => (
          <OverlayRow
            key={index}
            overlay={overlay}
            variables={variables}
            sectionNames={sectionNames}
            onChange={(next) => {
              replace(index, next);
            }}
            onRemove={() => {
              remove(index);
            }}
          />
        ))}
      </div>

      <Button variant="secondary" className="gap-1.5" onClick={add}>
        <Plus className="size-4" aria-hidden /> {t('globalOverlay.add')}
      </Button>
    </SectionDisclosure>
  );
};

const OverlayRow = ({
  overlay,
  variables,
  sectionNames,
  onChange,
  onRemove,
}: {
  overlay: GlobalTextOverlay;
  variables: string[];
  sectionNames: string[];
  onChange: (next: GlobalTextOverlay) => void;
  onRemove: () => void;
}) => {
  const { t } = useTranslation('admin');
  const position = overlay.position ?? 'top-right';

  return (
    <div className="rounded-xl border border-foreground/10 bg-surface p-3 space-y-3">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <VariableTextField
            value={overlayDisplayText(overlay.text)}
            onChange={(text) => {
              onChange(withOverlayText(overlay, text));
            }}
            variables={variables.map((name) => ({ name, scope: 'global' as const }))}
            placeholder={t('globalOverlay.textPlaceholder')}
            aria-label={t('globalOverlay.text')}
            className={EDITOR_INPUT_CLASS}
          />
        </div>
        <button
          type="button"
          aria-label={t('globalOverlay.remove')}
          onClick={onRemove}
          className="tap relative mt-1.5 shrink-0 rounded-md p-1.5 text-gray-500 transition-colors after:absolute after:-inset-2 after:content-[''] hover:bg-foreground/5 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 active:scale-90"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <PositionPad
          value={position}
          onChange={(next) => {
            onChange({ ...overlay, position: next });
          }}
        />
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">
            {t('globalOverlay.color')}
          </span>
          <ColorPicker
            aria-label={t('globalOverlay.color')}
            value={overlay.color ?? DEFAULT_COLOR}
            onChange={(color) => {
              onChange({ ...overlay, color });
            }}
          />
        </div>
      </div>
      <RevealControl
        reveal={overlay.reveal}
        onChange={(reveal) => {
          onChange({ ...overlay, reveal });
        }}
      />
      <TextEffectControl
        effect={overlay.effect}
        onChange={(effect) => {
          onChange({ ...overlay, effect });
        }}
      />
      <OverlayAdvanced overlay={overlay} sectionNames={sectionNames} onChange={onChange} />
    </div>
  );
};

// One-tap spatial anchor picker: a 3×3 pad mirroring the frame, with the selected anchor's name as
// a live readout so the dots never read as an unlabeled control. Radios for keyboard/AT semantics.
const PositionPad = ({ value, onChange }: { value: Position; onChange: (next: Position) => void }) => {
  const { t } = useTranslation('admin');

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          {t('globalOverlay.position')}
        </span>
        <span className="truncate text-xs text-gray-500">{t(`globalOverlay.pos.${value}`)}</span>
      </div>
      <div
        role="radiogroup"
        aria-label={t('globalOverlay.position')}
        className="grid w-fit grid-cols-3 gap-1 rounded-xl border border-foreground/10 bg-surface-inset p-1"
      >
        {POSITION_GRID.map((pos, i) => {
          if (!pos) return <span key={`gap-${i}`} aria-hidden className="h-9 w-9" />;

          const active = pos === value;

          return (
            <button
              key={pos}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={t(`globalOverlay.pos.${pos}`)}
              title={t(`globalOverlay.pos.${pos}`)}
              onClick={() => {
                onChange(pos);
              }}
              className={cn(
                'tap relative grid h-9 w-9 place-items-center rounded-lg transition-colors after:absolute after:-inset-1 after:content-[""] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                active
                  ? 'bg-brand-500/15 text-brand-600 dark:text-brand-300'
                  : 'text-gray-500 hover:bg-foreground/5 hover:text-foreground'
              )}
            >
              <span
                aria-hidden
                className={cn('rounded-full bg-current', active ? 'h-2.5 w-2.5' : 'h-1.5 w-1.5 opacity-50')}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};

// The set styling overrides condensed into the disclosure's collapsed summary line, or the
// "Defaults" fallback when none is set.
function advancedSummary(overlay: GlobalTextOverlay, t: (key: string, opts?: { count: number }) => string): string {
  const parts = [
    overlay.font ? (FONTS.find((f) => f.id === overlay.font)?.label ?? overlay.font) : null,
    overlay.size === undefined ? null : `${overlay.size}px`,
    overlay.opacity === undefined ? null : `${Math.round(overlay.opacity * 100)}%`,
    overlay.sections ? t('globalOverlay.sectionsSummary', { count: overlay.sections.length }) : null,
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(' · ') : t('globalOverlay.advancedNone');
}

// The styling overrides the engine already honours, tucked behind a disclosure: font, size, static
// opacity (superseded by a reveal, which animates alpha itself) and per-scene targeting.
const OverlayAdvanced = ({
  overlay,
  sectionNames,
  onChange,
}: {
  overlay: GlobalTextOverlay;
  sectionNames: string[];
  onChange: (next: GlobalTextOverlay) => void;
}) => {
  const { t } = useTranslation('admin');
  const hasReveal = Boolean(overlay.reveal);
  const summary = advancedSummary(overlay, t);

  return (
    <SectionDisclosure label={t('globalOverlay.advanced')} summary={summary}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">
            {t('globalOverlay.font')}
          </span>
          <Select
            value={overlay.font ?? ''}
            onValueChange={(font) => {
              onChange({ ...overlay, font });
            }}
          >
            <SelectTrigger aria-label={t('globalOverlay.font')} className="w-full">
              <SelectValue placeholder={t('globalOverlay.fontDefault')} />
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
        <NumberField
          label={t('globalOverlay.size')}
          value={overlay.size ?? DEFAULT_SIZE}
          min={8}
          max={300}
          step={1}
          unit="px"
          compact
          className="w-full"
          onChange={(size) => {
            onChange({ ...overlay, size });
          }}
        />
      </div>
      <div>
        {/* fieldset natively disables the slider while a reveal owns the alpha (the engine ignores
            the static opacity in that case), matching the preset precedence. */}
        <fieldset disabled={hasReveal} className={cn(hasReveal && 'opacity-50')}>
          <RangeSlider
            label={t('globalOverlay.opacity')}
            value={overlay.opacity ?? DEFAULT_OPACITY}
            min={0}
            max={1}
            step={0.05}
            resetTo={DEFAULT_OPACITY}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(opacity) => {
              onChange(opacity >= 1 ? withoutOpacity(overlay) : { ...overlay, opacity });
            }}
          />
        </fieldset>
        {hasReveal && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{t('globalOverlay.opacityRevealNote')}</p>}
      </div>
      <OverlaySectionsControl overlay={overlay} sectionNames={sectionNames} onChange={onChange} />
    </SectionDisclosure>
  );
};

function withoutOpacity(overlay: GlobalTextOverlay): GlobalTextOverlay {
  const { opacity: _opacity, ...rest } = overlay;

  return rest;
}

// Per-scene targeting as toggle chips: none selected = the overlay draws on every section (the field
// stays absent from the descriptor); picking scenes narrows it to that subset.
const OverlaySectionsControl = ({
  overlay,
  sectionNames,
  onChange,
}: {
  overlay: GlobalTextOverlay;
  sectionNames: string[];
  onChange: (next: GlobalTextOverlay) => void;
}) => {
  const { t } = useTranslation('admin');
  const choices = overlaySectionChoices(sectionNames, overlay.sections);

  if (choices.length === 0) return null;

  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">
        {t('globalOverlay.sections')}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {choices.map((name) => {
          const active = overlay.sections?.includes(name) ?? false;

          return (
            <button
              key={name}
              type="button"
              aria-pressed={active}
              onClick={() => {
                const sections = toggleOverlaySection(overlay.sections, name);
                onChange(sections ? { ...overlay, sections } : withoutSections(overlay));
              }}
              className={cn(
                'tap relative flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all after:absolute after:-inset-1 after:content-[""] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                active
                  ? 'border-brand-500/40 bg-brand-500/10 text-brand-600 dark:text-brand-300'
                  : 'border-foreground/10 text-gray-500 hover:text-foreground'
              )}
            >
              {active && <Check className="size-3" aria-hidden />}
              {name}
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('globalOverlay.sectionsHint')}</p>
    </div>
  );
};

function withoutSections(overlay: GlobalTextOverlay): GlobalTextOverlay {
  const { sections: _sections, ...rest } = overlay;

  return rest;
}
