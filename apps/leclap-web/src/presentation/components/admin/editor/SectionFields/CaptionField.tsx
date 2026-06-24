// The "Caption (on screen)" control for visual sections (video/color/image): a short title BURNED
// INTO the video as a styled drawtext. A text input writes the default-locale ('en') string, plus a
// position + style segmented control. An "Advanced" disclosure exposes per-caption overrides
// (align/font/size/colour/box) that layer on top of the style preset to reproduce a bespoke look.
// Distinct from the "What to film"/Notes prompt (never rendered) and the OverlayCanvas (power-user
// positional text) — this is the simple "put a short title on the video" field. Empty text clears the
// whole caption; a non-empty edit preserves the model's textI18n/position/style/override stash so
// non-en locales and overrides survive a round-trip.
import { useTranslation } from 'react-i18next';
import {
  CAPTION_POSITIONS,
  CAPTION_STYLES,
  CAPTION_ALIGNS,
} from 'ffmpeg-video-composer/src/schemas/section.schemas.ts';
import { FONTS } from '@leclap/creative-kit/fonts';
import type { CaptionAlign, CaptionPosition, CaptionStyle, VisualCaption } from '../../templateEditorModel';
import {
  Checkbox,
  ColorPicker,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui';
import { SegmentedControl, RangeSlider, type SegmentOption } from '../controls';
import { SectionDisclosure } from '../SectionDisclosure';
import { TextEffectControl } from '../TextEffectControl';
import { NumberField } from '@/presentation/components/ui/NumberField';

const DEFAULT_FONTSIZE = 48;

type Caption = NonNullable<VisualCaption['caption']>;

const DEFAULT_POSITION: CaptionPosition = 'lower-third';
const DEFAULT_STYLE: CaptionStyle = 'bar';
const DEFAULT_ALIGN: CaptionAlign = 'center';
const DEFAULT_BOX_COLOR = '#000000';
const DEFAULT_BOX_OPACITY = 0.8;

// Clear the whole caption when the text is blank; otherwise merge the new fields over the existing
// caption object so textI18n/position/style/overrides aren't dropped on edit.
export function nextCaption(current: Caption | undefined, patch: Partial<Caption>): Caption | undefined {
  const merged = { ...current, ...patch };
  const text = merged.text?.trim() ?? '';

  if (text === '') return undefined;

  return { ...merged, text };
}

interface CaptionFieldProps {
  caption: Caption | undefined;
  onChange: (caption: Caption | undefined) => void;
  inputCls: string;
}

export const CaptionField = ({ caption, onChange, inputCls }: CaptionFieldProps) => {
  const { t } = useTranslation('admin');
  const position = caption?.position ?? DEFAULT_POSITION;
  const style = caption?.style ?? DEFAULT_STYLE;

  const positionOptions: ReadonlyArray<SegmentOption<CaptionPosition>> = CAPTION_POSITIONS.map((value) => ({
    value,
    label: t(`caption.position.${value}`),
  }));

  const styleOptions: ReadonlyArray<SegmentOption<CaptionStyle>> = CAPTION_STYLES.map((value) => ({
    value,
    label: t(`caption.style.${value}`),
  }));

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">
          {t('caption.label')}
        </span>
        <input
          type="text"
          value={caption?.text ?? ''}
          onChange={(e) => {
            onChange(nextCaption(caption, { text: e.target.value }));
          }}
          placeholder={t('caption.placeholder')}
          className={inputCls}
        />
        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{t('caption.hint')}</span>
      </label>
      {caption?.text.trim() && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <SegmentedControl
              label={t('caption.positionLabel')}
              value={position}
              options={positionOptions}
              onChange={(next) => {
                onChange(nextCaption(caption, { position: next }));
              }}
            />
            <SegmentedControl
              label={t('caption.styleLabel')}
              value={style}
              options={styleOptions}
              onChange={(next) => {
                onChange(nextCaption(caption, { style: next }));
              }}
            />
          </div>
          <CaptionAdvanced caption={caption} onChange={onChange} />
        </>
      )}
    </div>
  );
};

// The per-caption overrides, tucked behind a disclosure: align, font, size, colour, box. Each writes
// via nextCaption so the textI18n stash and the other fields survive.
const CaptionAdvanced = ({
  caption,
  onChange,
}: {
  caption: Caption;
  onChange: (caption: Caption | undefined) => void;
}) => {
  const { t } = useTranslation('admin');
  const align = caption.align ?? DEFAULT_ALIGN;

  const alignOptions: ReadonlyArray<SegmentOption<CaptionAlign>> = CAPTION_ALIGNS.map((value) => ({
    value,
    label: t(`caption.align.${value}`),
  }));

  const summaryParts = [
    caption.align ? t(`caption.align.${caption.align}`) : null,
    caption.font ? (FONTS.find((f) => f.id === caption.font)?.label ?? caption.font) : null,
    caption.color ?? null,
  ].filter((part): part is string => Boolean(part));
  const summary = summaryParts.length > 0 ? summaryParts.join(' · ') : t('caption.advancedNone');

  return (
    <SectionDisclosure label={t('caption.advanced')} summary={summary}>
      <SegmentedControl
        label={t('caption.alignLabel')}
        value={align}
        options={alignOptions}
        onChange={(next) => {
          onChange(nextCaption(caption, { align: next }));
        }}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">
            {t('caption.font')}
          </span>
          <Select
            value={caption.font ?? ''}
            onValueChange={(font) => {
              onChange(nextCaption(caption, { font }));
            }}
          >
            <SelectTrigger aria-label={t('caption.font')} className="w-full">
              <SelectValue placeholder={t('caption.fontDefault')} />
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
          label={t('caption.fontsize')}
          value={caption.fontsize ?? DEFAULT_FONTSIZE}
          min={8}
          max={300}
          step={1}
          unit="px"
          compact
          className="w-full"
          onChange={(fontsize) => {
            onChange(nextCaption(caption, { fontsize }));
          }}
        />
      </div>
      <div>
        <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">
          {t('caption.color')}
        </span>
        <ColorPicker
          aria-label={t('caption.color')}
          value={caption.color ?? '#ffffff'}
          onChange={(color) => {
            onChange(nextCaption(caption, { color }));
          }}
        />
      </div>
      <CaptionBoxControls caption={caption} onChange={onChange} />
      <TextEffectControl
        effect={caption.effect}
        onChange={(effect) => {
          onChange(nextCaption(caption, { effect }));
        }}
      />
    </SectionDisclosure>
  );
};

// The "Background box" toggle plus its colour picker and opacity slider (revealed only when on).
const CaptionBoxControls = ({
  caption,
  onChange,
}: {
  caption: Caption;
  onChange: (caption: Caption | undefined) => void;
}) => {
  const { t } = useTranslation('admin');
  const boxOn = caption.box ?? false;

  return (
    <div className="space-y-2">
      <label className="flex w-fit cursor-pointer select-none items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
        <Checkbox
          checked={boxOn}
          onCheckedChange={(c) => {
            onChange(nextCaption(caption, { box: c === true }));
          }}
        />
        {t('caption.box')}
      </label>
      {boxOn && (
        <div className="space-y-2">
          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">
              {t('caption.boxColor')}
            </span>
            <ColorPicker
              aria-label={t('caption.boxColor')}
              value={caption.boxColor ?? DEFAULT_BOX_COLOR}
              onChange={(boxColor) => {
                onChange(nextCaption(caption, { boxColor }));
              }}
            />
          </div>
          <RangeSlider
            label={t('caption.boxOpacity')}
            value={caption.boxOpacity ?? DEFAULT_BOX_OPACITY}
            min={0}
            max={1}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(boxOpacity) => {
              onChange(nextCaption(caption, { boxOpacity }));
            }}
          />
        </div>
      )}
    </div>
  );
};
