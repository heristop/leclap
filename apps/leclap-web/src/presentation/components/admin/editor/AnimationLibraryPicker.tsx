// The animation library: engine primitives first, grouped (Light, Focus, Celebrate, Frames, Ambient), the
// legacy APNG overlays last as Samples. An engine card is an action — it inserts that primitive into the
// section, tuned to it, and opens its parameter panel (the host does the insert). A sample card selects the
// stock overlay like before. Two-part recipes ("Combinations") sit on top when the host can insert them.
// Without an engine host (the whole-video overlays, which cannot hold section graphics) only the samples show.
import type { DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from '@/presentation/components/icons';
import { cn } from '@/lib/utils';
import { ANIMATION_PICKER, type PickerCard, type PickerGroup } from '@/data/mediaCatalog';
import { ANIMATION_EFFECT_PRESETS, type AnimationEffectPreset, type EngineLibraryEntry } from '../templateEditorModel';
import { AnimationThumb, SampleThumb } from './AnimationMedia';
import { CANVAS_DND_MIME, type DropPayload } from '../editor-shell/canvasDrop';

export interface AnimationLibraryPickerProps {
  /** The url of the sample currently chosen (marks its card). */
  selectedUrl?: string;
  onPickSample: (card: PickerCard) => void;
  /** Inserts an engine primitive; absent = this host only takes overlays, so only the samples show. */
  onPickEngine?: (entry: EngineLibraryEntry) => void;
  /** Inserts a two-part recipe (shown with onPickEngine). */
  onPickRecipe?: (preset: AnimationEffectPreset) => void;
  /** Override the sample list (config-driven curated libraries). */
  samples?: PickerCard[];
}

const startCanvasDrag = (event: DragEvent, payload: DropPayload) => {
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData(CANVAS_DND_MIME, JSON.stringify(payload));
};

const GROUP_LABEL_CLS = 'text-[0.65rem] font-semibold uppercase tracking-widest text-gray-400';

export const AnimationLibraryPicker = ({
  selectedUrl,
  onPickSample,
  onPickEngine,
  onPickRecipe,
  samples,
}: AnimationLibraryPickerProps) => {
  const groups: PickerGroup[] = ANIMATION_PICKER.flatMap((group) => {
    if (group.group === 'samples') return [{ ...group, cards: samples ?? group.cards }];

    return onPickEngine ? [group] : [];
  });

  return (
    <div className="space-y-4">
      {onPickRecipe ? <RecipeRow onPick={onPickRecipe} /> : null}
      {groups.map((group) => (
        <PickerSection
          key={group.group}
          group={group}
          selectedUrl={selectedUrl}
          onPick={(card) => {
            if (card.engine) {
              onPickEngine?.(card.engine);

              return;
            }

            onPickSample(card);
          }}
          hint={group.group === 'samples' && onPickEngine !== undefined}
        />
      ))}
    </div>
  );
};

const RecipeRow = ({ onPick }: { onPick: (preset: AnimationEffectPreset) => void }) => {
  const { t } = useTranslation('admin');

  return (
    <section aria-label={t('animation.effects.label')} className="space-y-1.5">
      <h4 className={GROUP_LABEL_CLS}>{t('animation.effects.label')}</h4>
      <div className="flex flex-wrap gap-1.5">
        {ANIMATION_EFFECT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            title={t(preset.descriptionKey)}
            onClick={() => {
              onPick(preset);
            }}
            className="tap rounded-full border border-foreground/10 bg-surface px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:border-brand-500/50 hover:bg-brand-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          >
            {t(preset.nameKey)}
          </button>
        ))}
      </div>
    </section>
  );
};

interface PickerSectionProps {
  group: PickerGroup;
  selectedUrl?: string;
  onPick: (card: PickerCard) => void;
  /** Explain that samples are stock overlays (shown when engine effects are offered above). */
  hint: boolean;
}

const PickerSection = ({ group, selectedUrl, onPick, hint }: PickerSectionProps) => {
  const { t } = useTranslation('admin');
  const headingId = `animation-group-${group.group}`;

  if (group.cards.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="space-y-1.5">
      <h4 id={headingId} className={GROUP_LABEL_CLS}>
        {t(`animation.groups.${group.group}`)}
      </h4>
      {hint ? <p className="text-[0.7rem] leading-snug text-gray-500">{t('animation.groups.samplesHint')}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        {group.cards.map((card) => (
          <PickerCardButton
            key={card.key}
            card={card}
            selected={card.sample !== undefined && card.sample.url === selectedUrl}
            onPick={onPick}
          />
        ))}
      </div>
    </section>
  );
};

const THUMB_CLASS = 'aspect-video w-full overflow-hidden transition-transform duration-300 group-hover:scale-[1.03]';

const PickerCardButton = ({
  card,
  selected,
  onPick,
}: {
  card: PickerCard;
  selected: boolean;
  onPick: (card: PickerCard) => void;
}) => {
  const { t } = useTranslation('admin');
  const label = t(card.labelKey, { defaultValue: card.fallbackLabel });
  const sample = card.sample;

  return (
    <button
      type="button"
      aria-pressed={sample ? selected : undefined}
      aria-label={sample ? t('animation.picker.sampleLabel', { label }) : t('animation.picker.addLabel', { label })}
      draggable={sample !== undefined}
      onDragStart={(event) => {
        if (!sample) return;

        startCanvasDrag(event, { source: 'library', element: 'animation', url: sample.url, label: sample.label });
      }}
      onClick={() => {
        onPick(card);
      }}
      className={cn(
        'group relative block overflow-hidden rounded-xl border bg-surface text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
        selected ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-foreground/10 hover:border-brand-500/40'
      )}
    >
      {sample ? (
        <SampleThumb url={sample.url} className={THUMB_CLASS} />
      ) : (
        <AnimationThumb thumb={card.thumb} poster={card.poster} fallback={label} className={THUMB_CLASS} />
      )}
      <span className="flex items-center gap-1 px-2 py-1.5">
        <span className="min-w-0 flex-1 truncate text-[0.7rem] font-semibold text-foreground">{label}</span>
        {sample ? (
          <span className="shrink-0 rounded bg-foreground/[0.06] px-1 py-px text-[0.55rem] font-semibold uppercase tracking-wider text-gray-500">
            {t('animation.picker.sampleBadge')}
          </span>
        ) : null}
      </span>
      {selected ? (
        <Check className="absolute right-2 top-2 h-4 w-4 rounded-full bg-brand-500 p-0.5 text-white" />
      ) : null}
    </button>
  );
};
