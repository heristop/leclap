// The boundary control rendered *between* two section cards. A compact chip shows the
// transition the boundary actually renders with — its own override, or the template default
// when none is set ("✂ Cut" / "⤬ Wipe left · 0.4s"); clicking it opens a dialog to pick a
// transition (grouped) + duration. Writes through setTransitionAfter (the chip for the last
// visual section is never rendered — the validator rejects a dangling one). When the template
// declares a non-cut default transition, the dialog leads with a "Template default" tile that
// clears the override, and picking "Cut" stores an explicit cut so the boundary stays hard.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Scissors } from '@/presentation/components/icons';
import { SparklesIcon } from '@/presentation/components/icons/sparkles';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/presentation/components/ui';
import { cn } from '@/lib/utils';
import type { DefaultTransition, SectionTransition } from '../templateEditorModel';
import { transitionGroups, transitionLabel } from './transitionGroups';
import { TransitionPreview } from './TransitionPreview';
import { RangeSlider } from './controls';
import { DEFAULT_TILE, boundaryPick, effectiveBoundary, hasNonCutDefault } from './default-transition.logic';

interface TransitionPickerProps {
  /** Current boundary override, or undefined to inherit the template default (a hard cut when none). */
  transition: SectionTransition | undefined;
  onChange: (transition: SectionTransition | undefined) => void;
  /** The template-wide default transition (global.transition) this boundary falls back to. */
  defaultTransition?: DefaultTransition;
}

const GROUPS = transitionGroups();
const DEFAULT_DURATION = 0.5;

// Tile label for one xfade name — the same capitalisation the boundary chip uses (transitionLabel),
// so the grid never shows an all-lowercase raw engine id next to a title-cased chip.
const prettyName = (name: string): string => name.charAt(0).toUpperCase() + name.slice(1);

export const TransitionPicker = ({ transition, onChange, defaultTransition }: TransitionPickerProps) => {
  const { t } = useTranslation('admin');
  const [open, setOpen] = useState(false);
  const effective = effectiveBoundary(transition, defaultTransition);
  const isCut = effective.type === 'cut';
  const duration = transition?.duration ?? defaultTransition?.duration ?? DEFAULT_DURATION;
  const current = transition?.type ?? (hasNonCutDefault(defaultTransition) ? DEFAULT_TILE : 'cut');

  const pick = (type: string) => {
    onChange(boundaryPick(type, duration, defaultTransition));
  };

  return (
    <div className="relative -my-1 grid place-items-center">
      {/* The connector line the chip sits on, echoing the timeline. */}
      <div aria-hidden className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-foreground/10" />
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        title={effective.fromDefault ? t('transition.defaultBadge') : undefined}
        className={cn(
          'tap relative z-10 inline-flex items-center gap-1.5 rounded-full border bg-surface-2 px-3 py-1 text-xs font-semibold text-gray-500 shadow-sm transition-all hover:-translate-y-px hover:border-brand-500/40 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:hover:text-brand-300',
          // A dashed border marks a boundary inheriting the template default (no override of its own).
          effective.fromDefault ? 'border-dashed border-foreground/25' : 'border-foreground/10'
        )}
      >
        {isCut ? <Scissors className="h-3.5 w-3.5" /> : <SparklesIcon size={14} className="text-brand-500" />}
        {transitionLabel(effective.type, effective.duration, t)}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('transition.title')}</DialogTitle>
            <DialogDescription>{t('transition.description')}</DialogDescription>
          </DialogHeader>
          {transition && transition.type !== 'cut' && (
            <div className="mb-3">
              <RangeSlider
                label={t('transition.duration')}
                value={duration}
                min={0.1}
                max={2}
                step={0.1}
                format={(v) => `${v.toFixed(1)}s`}
                resetTo={defaultTransition?.duration ?? DEFAULT_DURATION}
                onChange={(d) => {
                  onChange({ type: transition.type, duration: d });
                }}
              />
            </div>
          )}
          <div className="max-h-[55vh] overflow-y-auto pr-1">
            <TransitionGrid
              current={current}
              t={t}
              onPick={pick}
              defaultTransition={hasNonCutDefault(defaultTransition) ? defaultTransition : undefined}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// The scrollable grid of grouped transition options + the leading "Cut" tile. When a non-cut
// template default is passed, a "Template default" tile leads the first section — picking it
// clears the boundary's override. Shared with the Basics panel's default-transition field
// (which omits `defaultTransition`: the default itself has nothing to inherit).
export const TransitionGrid = ({
  current,
  t,
  onPick,
  defaultTransition,
}: {
  current: string;
  t: TFunction<'admin'>;
  onPick: (type: string) => void;
  defaultTransition?: DefaultTransition;
}) => (
  <div className="space-y-4">
    <section>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-gray-400">{t('transition.none')}</h3>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {defaultTransition && (
          <TransitionTile
            type={DEFAULT_TILE}
            previewType={defaultTransition.type}
            label={t('transition.defaultTile', {
              label: transitionLabel(defaultTransition.type, defaultTransition.duration, t),
            })}
            active={current === DEFAULT_TILE}
            onPick={onPick}
          />
        )}
        <TransitionTile type="cut" label={t('transition.cut')} active={current === 'cut'} onPick={onPick} />
      </div>
    </section>
    {GROUPS.map((group) => (
      <section key={group.label}>
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-gray-400">
          {t(`transition.group.${group.label}`)}
        </h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {group.names.map((name) => (
            <TransitionTile key={name} type={name} label={prettyName(name)} active={current === name} onPick={onPick} />
          ))}
        </div>
      </section>
    ))}
  </div>
);

interface TileProps {
  type: string;
  /** The transition the thumbnail animates as — defaults to `type` (differs for the default tile). */
  previewType?: string;
  label: string;
  active: boolean;
  onPick: (type: string) => void;
}

const TransitionTile = ({ type, previewType, label, active, onPick }: TileProps) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={() => {
      onPick(type);
    }}
    className={cn(
      'tp-card group flex flex-col items-center gap-1.5 rounded-xl border p-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
      active
        ? 'border-brand-500 bg-brand-500/10'
        : 'border-foreground/10 hover:border-brand-500/40 hover:bg-foreground/5'
    )}
  >
    <TransitionPreview type={previewType ?? type} className="aspect-video w-full" />
    <span className="w-full truncate text-center text-[0.65rem] font-medium text-gray-600 dark:text-gray-300">
      {label}
    </span>
  </button>
);
