// The Basics panel's template-wide default transition control (state.defaultTransition →
// descriptor global.transition). Every scene boundary that doesn't pick its own transition
// renders with this one, so it's the one-stop way to give a whole template fades without
// touching each boundary chip. Reuses the boundary picker's grouped dialog (TransitionGrid).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Scissors } from '@/presentation/components/icons';
import { SparklesIcon } from '@/presentation/components/icons/sparkles';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/presentation/components/ui';
import type { DefaultTransition } from '../templateEditorModel';
import { transitionLabel } from './transitionGroups';
import { TransitionGrid } from './TransitionPicker';
import { TransitionPreview } from './TransitionPreview';
import { RangeSlider } from './controls';

interface DefaultTransitionFieldProps {
  value: DefaultTransition;
  onChange: (next: DefaultTransition) => void;
}

export const DefaultTransitionField = ({ value, onChange }: DefaultTransitionFieldProps) => {
  const { t } = useTranslation('admin');
  const [open, setOpen] = useState(false);
  const isCut = value.type === 'cut';

  return (
    <div>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {t('transition.defaultField')}
      </span>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        className="field-focus-gradient [--field-fill:var(--color-surface-inset)] flex w-full items-center gap-2.5 rounded-lg border border-foreground/15 bg-surface-inset px-3 py-2 text-left text-sm text-foreground transition-colors hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
      >
        {/* A live thumbnail of the picked transition, animating like the dialog tiles. */}
        <TransitionPreview type={value.type} className="aspect-video w-12 shrink-0" />
        {isCut ? (
          <Scissors className="size-3.5 shrink-0 text-gray-500" />
        ) : (
          <SparklesIcon size={14} className="shrink-0 text-brand-500" />
        )}
        <span className="truncate font-medium">{transitionLabel(value.type, value.duration, t)}</span>
      </button>
      <p className="mt-1 text-xs text-muted-foreground">{t('transition.defaultHint')}</p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('transition.defaultField')}</DialogTitle>
            <DialogDescription>{t('transition.defaultDescription')}</DialogDescription>
          </DialogHeader>
          {!isCut && (
            <div className="mb-3">
              <RangeSlider
                label={t('transition.duration')}
                value={value.duration}
                min={0.1}
                max={2}
                step={0.1}
                format={(v) => `${v.toFixed(1)}s`}
                onChange={(duration) => {
                  onChange({ type: value.type, duration });
                }}
              />
            </div>
          )}
          <div className="max-h-[55vh] overflow-y-auto pr-1">
            <TransitionGrid
              current={value.type}
              t={t}
              onPick={(type) => {
                onChange({ type, duration: value.duration });
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
