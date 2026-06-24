// The "Title card" control for color_background sections: kicker / headline / subtitle text, an accent
// colour, alignment, an entrance and fade toggles. Lowers to the descriptor `titleCard` sugar, which
// the engine turns into the drawtext/drawbox/fade filters intros used to author by hand. Clearing every
// line removes the card. Distinct from the positional OverlayCanvas — this is the structured card.
import { useTranslation } from 'react-i18next';
import type { TitleCard } from '../../templateEditorModel';
import { ColorPicker } from '@/presentation/components/ui';
import { SegmentedControl, type SegmentOption } from '../controls';
import { RevealControl } from '../RevealControl';

const DEFAULT_ACCENT = '#7C83FF';
type Align = NonNullable<TitleCard['align']>;

function lineText(line: TitleCard['headline']): string {
  return line?.en ?? '';
}

function hasAnyText(card: TitleCard): boolean {
  return [card.kicker, card.headline, card.subtitle].some((line) => lineText(line).trim() !== '');
}

// Merge a patch over the current card; clear the whole card once no line has text.
function nextTitleCard(current: TitleCard | undefined, patch: Partial<TitleCard>): TitleCard | undefined {
  const merged: TitleCard = { ...current, ...patch };

  return hasAnyText(merged) ? merged : undefined;
}

function setLine(value: string): TitleCard['headline'] | undefined {
  return value.trim() === '' ? undefined : { en: value };
}

interface TitleCardFieldProps {
  titleCard: TitleCard | undefined;
  onChange: (titleCard: TitleCard | undefined) => void;
  inputCls: string;
}

export const TitleCardField = ({ titleCard, onChange, inputCls }: TitleCardFieldProps) => {
  const { t } = useTranslation('admin');
  const card = titleCard;
  const align = card?.align ?? 'left';

  const alignOptions: ReadonlyArray<SegmentOption<Align>> = [
    { value: 'left', label: t('titleCard.alignLeft') },
    { value: 'center', label: t('titleCard.alignCenter') },
  ];

  const patch = (next: Partial<TitleCard>) => {
    onChange(nextTitleCard(card, next));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">{t('titleCard.hint')}</p>
      <Line
        label={t('titleCard.kicker')}
        placeholder={t('titleCard.kickerPlaceholder')}
        value={lineText(card?.kicker)}
        inputCls={inputCls}
        onChange={(v) => {
          patch({ kicker: setLine(v) });
        }}
      />
      <Line
        label={t('titleCard.headline')}
        placeholder={t('titleCard.headlinePlaceholder')}
        value={lineText(card?.headline)}
        inputCls={inputCls}
        onChange={(v) => {
          patch({ headline: setLine(v) });
        }}
      />
      <Line
        label={t('titleCard.subtitle')}
        placeholder={t('titleCard.subtitlePlaceholder')}
        value={lineText(card?.subtitle)}
        inputCls={inputCls}
        onChange={(v) => {
          patch({ subtitle: setLine(v) });
        }}
      />
      {card && hasAnyText(card) && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">
                {t('titleCard.accent')}
              </span>
              <ColorPicker
                aria-label={t('titleCard.accent')}
                value={card.accent ?? DEFAULT_ACCENT}
                onChange={(accent) => {
                  patch({ accent });
                }}
              />
            </div>
            <SegmentedControl
              label={t('titleCard.align')}
              value={align}
              options={alignOptions}
              onChange={(next) => {
                patch({ align: next });
              }}
            />
          </div>
          <RevealControl
            reveal={card.reveal}
            onChange={(reveal) => {
              patch({ reveal });
            }}
          />
        </>
      )}
    </div>
  );
};

// One labelled text line — shared by kicker / headline / subtitle.
const Line = ({
  label,
  placeholder,
  value,
  inputCls,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  inputCls: string;
  onChange: (value: string) => void;
}) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</span>
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      className={inputCls}
      onChange={(e) => {
        onChange(e.target.value);
      }}
    />
  </label>
);
