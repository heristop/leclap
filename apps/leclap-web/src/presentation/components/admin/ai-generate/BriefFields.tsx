// The brief: a labelled textarea, example prompts that fill it in one tap, and the two hints a
// person most often wants to pin (format and length). Everything else is left to the model.
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { Orientation } from '@/application/usecases/ai-template/system-prompt';
import { SegmentedControl, Select, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui';
import { EditorSelectContent } from '../editor/editor-select-content';
import { MIN_BRIEF_LENGTH } from './ai-generation.logic';

export const EXAMPLE_KEYS = ['launch', 'tutorial', 'hook', 'cinematic', 'recap', 'event'] as const;
const DURATIONS = ['auto', '15', '30', '60'] as const;

interface BriefFieldsProps {
  brief: string;
  onBriefChange: (brief: string) => void;
  orientation: Orientation | 'auto';
  onOrientationChange: (value: Orientation | 'auto') => void;
  duration: string;
  onDurationChange: (value: string) => void;
  disabled: boolean;
}

const LABEL = 'mb-1.5 block text-sm font-medium text-foreground';

export const BriefFields = ({
  brief,
  onBriefChange,
  orientation,
  onOrientationChange,
  duration,
  onDurationChange,
  disabled,
}: BriefFieldsProps) => {
  const { t } = useTranslation('ai');
  const id = useId();
  const tooShort = brief.trim().length > 0 && brief.trim().length < MIN_BRIEF_LENGTH;

  return (
    <div className="grid gap-4">
      <div>
        <label htmlFor={id} className={LABEL}>
          {t('brief.label')}
        </label>
        <textarea
          id={id}
          value={brief}
          rows={4}
          disabled={disabled}
          placeholder={t('brief.placeholder')}
          aria-describedby={tooShort ? `${id}-short` : undefined}
          onChange={(event) => {
            onBriefChange(event.target.value);
          }}
          className="field-focus-gradient block w-full resize-y rounded-lg border border-divider bg-surface-2 px-3 py-2.5 text-[0.95rem] leading-relaxed text-foreground placeholder:text-gray-500 transition-colors disabled:opacity-60"
        />
        {tooShort && (
          <p id={`${id}-short`} className="mt-1.5 text-xs text-[var(--color-warning)]">
            {t('brief.tooShort')}
          </p>
        )}
      </div>
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">{t('brief.examples')}</p>
        <ul className="flex flex-wrap gap-2">
          {EXAMPLE_KEYS.map((key) => (
            <li key={key}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  onBriefChange(t(`examples.${key}`));
                }}
                className="tap min-h-9 rounded-full border border-divider bg-surface-2 px-3 text-left text-xs text-foreground/90 transition-colors duration-200 hover:border-brand-500/50 hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:opacity-50"
              >
                {t(`examples.${key}`)}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          <span className={LABEL}>{t('hints.orientation')}</span>
          <SegmentedControl
            ariaLabel={t('hints.orientation')}
            value={orientation}
            onChange={(value) => {
              onOrientationChange(value as Orientation | 'auto');
            }}
            options={(['auto', 'landscape', 'portrait', 'square'] as const).map((value) => ({
              value,
              label: t(`hints.${value}`),
            }))}
          />
        </div>
        <div className="min-w-32">
          <span id={`${id}-duration`} className={LABEL}>
            {t('hints.duration')}
          </span>
          <Select value={duration} onValueChange={onDurationChange} disabled={disabled}>
            <SelectTrigger aria-labelledby={`${id}-duration`}>
              <SelectValue />
            </SelectTrigger>
            <EditorSelectContent>
              {DURATIONS.map((value) => (
                <SelectItem key={value} value={value}>
                  {value === 'auto' ? t('hints.auto') : t('hints.seconds', { count: Number(value) })}
                </SelectItem>
              ))}
            </EditorSelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};
