// "Match a reference" inside Generate with AI: analyse a reference image or clip and attach its style
// guide, which the system prompt then carries as binding keep / avoid rules (palette and pacing only).
import { useTranslation } from 'react-i18next';
import { Button } from '@/presentation/components/ui';
import type { ReferenceStyle } from '@/infrastructure/style/analyze-reference';
import { ReferenceStylePanel } from '../style-reference/ReferenceStylePanel';

interface ReferenceStyleSectionProps {
  attached: boolean;
  onAttach: (style: ReferenceStyle) => void;
  onDetach: () => void;
  disabled: boolean;
}

export const ReferenceStyleSection = ({ attached, onAttach, onDetach, disabled }: ReferenceStyleSectionProps) => {
  const { t } = useTranslation('ai');

  return (
    <section aria-labelledby="ai-reference-label" className="grid gap-2 rounded-xl border border-divider p-4">
      <h3 id="ai-reference-label" className="text-sm font-medium text-foreground">
        {t('reference.label')}
      </h3>
      <p className="text-xs text-pretty text-muted-foreground">{t('reference.hint')}</p>
      <ReferenceStylePanel
        applyLabel={t('reference.use')}
        onApply={onAttach}
        disabled={disabled}
        footer={
          attached && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p role="status" className="text-xs text-pretty text-foreground">
                {t('reference.attached')}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-10"
                disabled={disabled}
                onClick={onDetach}
              >
                {t('reference.detach')}
              </Button>
            </div>
          )
        }
      />
    </section>
  );
};
