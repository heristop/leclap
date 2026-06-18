import { useState, startTransition } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  Play,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileText,
  Users,
  Lightbulb,
  Gauge,
  Proportions,
  Layers,
  Music,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';
import { type Template } from '@/services/templateService';
import { Button, Card } from '@/presentation/components/ui';
import { StopButton } from '@/presentation/components/StopButton';

interface VideoProcessorProps {
  isProcessing: boolean;
  canProcess: boolean;
  onStartProcessing: () => void;
  onCancelProcessing: () => void;
  error: string | null;
  template: Template | null;
  formData: Record<string, string>;
  uploadedFiles?: File[];
}

function getStatusLabel(actuallyProcessing: boolean, canProcess: boolean, t: TFunction<'process'>): string {
  if (actuallyProcessing) return t('processor.status.processingTitle');

  if (canProcess) return t('processor.status.readyTitle');

  return t('processor.status.setupTitle');
}

function getStatusDescription(actuallyProcessing: boolean, canProcess: boolean, t: TFunction<'process'>): string {
  if (actuallyProcessing) return t('processor.status.processingDescription');

  if (canProcess) return t('processor.status.readyDescription');

  return t('processor.status.setupDescription');
}

function StatusIcon({ actuallyProcessing, canProcess }: { actuallyProcessing: boolean; canProcess: boolean }) {
  // Spin the circular loader itself — not the square container (which would
  // rotate the rounded box into a wobbling diamond).
  if (actuallyProcessing) return <Loader2 className="w-5 h-5 animate-spin" />;

  if (canProcess) return <CheckCircle2 className="w-5 h-5" />;

  return <AlertCircle className="w-5 h-5" />;
}

function StatusBar({ actuallyProcessing, canProcess }: { actuallyProcessing: boolean; canProcess: boolean }) {
  const { t } = useTranslation('process');

  return (
    <Card elevation="flat" className="flex items-center justify-between p-4 bg-surface/40 rounded-xl backdrop-blur-sm">
      <div className="flex items-center space-x-3">
        <div
          className={clsx(
            'w-3 h-3 rounded-full transition-all duration-300',
            canProcess
              ? 'bg-success animate-pulse shadow-lg shadow-success/20'
              : 'bg-[var(--color-error)] shadow-lg shadow-[var(--color-error)]/20',
            actuallyProcessing && 'animate-ping'
          )}
        />
        <div>
          <p className="text-sm font-medium text-foreground">{getStatusLabel(actuallyProcessing, canProcess, t)}</p>
          <p className="text-xs text-gray-400">{getStatusDescription(actuallyProcessing, canProcess, t)}</p>
        </div>
      </div>

      {/* Status Icon */}
      <div
        className={clsx(
          'p-2 rounded-lg transition-all duration-200',
          canProcess ? 'bg-success/20 text-success-foreground' : 'bg-[var(--color-error)]/20 text-[var(--color-error)]'
        )}
      >
        <StatusIcon actuallyProcessing={actuallyProcessing} canProcess={canProcess} />
      </div>
    </Card>
  );
}

function ErrorDisplay({ error }: { error: string }) {
  const { t } = useTranslation('process');

  return (
    <Card
      elevation="flat"
      className="p-4 bg-[var(--color-error)]/10 border-[var(--color-error)]/30 rounded-xl fade-in backdrop-blur-sm"
    >
      <div className="flex items-start space-x-3">
        <AlertCircle className="w-5 h-5 text-[var(--color-error)] mt-0.5 flex-shrink-0" />
        <div>
          <h4 className="text-sm font-medium text-[var(--color-error)] mb-1">{t('processor.error.title')}</h4>
          <p className="text-sm text-[var(--color-error)]/80">{error}</p>
        </div>
      </div>
    </Card>
  );
}

function ActionButton({
  canProcess,
  actuallyProcessing,
  isOptimisticProcessing,
  onStartProcessing,
  onCancelProcessing,
}: {
  canProcess: boolean;
  actuallyProcessing: boolean;
  isOptimisticProcessing: boolean;
  onStartProcessing: () => void;
  onCancelProcessing: () => void;
}) {
  const { t } = useTranslation('process');

  // While processing, the shared danger StopButton cancels the render; otherwise the primary button
  // starts it. Stop stays clickable; Start is disabled until the project is ready.
  if (actuallyProcessing) {
    return (
      <div className="flex justify-center">
        <StopButton
          size="lg"
          onClick={onCancelProcessing}
          label={t('processor.action.stop')}
          className={clsx(isOptimisticProcessing && 'scale-95')}
        />
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <Button
        variant="primary"
        size="lg"
        onClick={onStartProcessing}
        disabled={!canProcess}
        aria-label={t('processor.action.start')}
        className={clsx('group px-8 py-4', canProcess && 'hover:scale-[1.03] active:scale-95')}
      >
        <span
          className={clsx(
            'p-2 rounded-lg transition-all duration-200 [&_svg]:size-6',
            canProcess ? 'bg-foreground/20' : 'bg-foreground/5'
          )}
        >
          <Play />
        </span>
        <span>{t('processor.action.start')}</span>
      </Button>
    </div>
  );
}

// Map each form field name (e.g. "form_1_name") to its descriptor label so the answer review shows
// "Name", not the raw machine key. Falls back to a de-slugged key when no label is authored.
function buildFieldLabels(template: Template): Map<string, string> {
  const labels = new Map<string, string>();

  for (const section of template.descriptor.sections ?? []) {
    for (const field of section.options?.fields ?? []) {
      const label = field.label.en ?? Object.values(field.label).find(Boolean);

      if (label) labels.set(field.name, label);
    }
  }

  return labels;
}

const humanizeKey = (key: string): string =>
  key
    .replace(/^form_\d+_/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

// One labelled metadata stat (icon + caption on top, value below) for the template's facts. Stacked
// so short values like "Intermediate" / "Landscape" get the full tile width.
function MetaItem({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-brand-500/5 px-3 py-2.5 ring-1 ring-brand-500/10">
      <div className="flex items-center gap-1.5">
        <Icon className="size-3.5 shrink-0 text-brand-500" aria-hidden="true" />
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-brand-800/55 dark:text-brand-200/45">
          {label}
        </p>
      </div>
      <p className="mt-1 text-sm font-semibold capitalize leading-tight text-brand-900 dark:text-brand-50">
        {children}
      </p>
    </div>
  );
}

function TemplateInfo({ template, formData }: { template: Template; formData: Record<string, string> }) {
  const { t } = useTranslation('process');
  const fieldLabels = buildFieldLabels(template);
  const answers = Object.entries(formData).filter(([, value]) => value.trim().length > 0);
  const musicOn = template.descriptor.global?.musicEnabled ?? false;

  return (
    <Card elevation="flat" className="p-5 bg-brand-500/10 border-brand-500/30 rounded-xl fade-in backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-500/20 text-brand-700 ring-1 ring-brand-500/20 dark:text-brand-300">
          {template.hasForm ? <Users className="size-5" /> : <FileText className="size-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-display text-base font-bold text-brand-900 dark:text-brand-50">
            {t('processor.template.selected', { name: template.name })}
          </h4>
          <p className="mt-0.5 text-sm leading-relaxed text-brand-800/70 dark:text-brand-200/70">
            {template.description}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetaItem icon={Gauge} label={t('processor.template.complexity')}>
          {template.complexity}
        </MetaItem>
        <MetaItem icon={Proportions} label={t('processor.template.orientation')}>
          {template.orientation}
        </MetaItem>
        <MetaItem icon={Layers} label={t('processor.template.sections')}>
          {template.descriptor.sections?.length ?? 0}
        </MetaItem>
        <MetaItem icon={Music} label={t('processor.template.music')}>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={clsx('size-1.5 rounded-full', musicOn ? 'bg-[var(--color-success)]' : 'bg-brand-500/40')}
            />
            {musicOn ? t('processor.template.musicEnabled') : t('processor.template.musicDisabled')}
          </span>
        </MetaItem>
      </div>

      {template.hasForm && answers.length > 0 && (
        <div className="mt-4 border-t border-brand-500/20 pt-4">
          <p className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-brand-800/55 dark:text-brand-200/45">
            {t('processor.template.formData')}
          </p>
          <dl className="space-y-1.5">
            {answers.map(([key, value]) => (
              <div key={key} className="flex items-baseline justify-between gap-3">
                <dt className="shrink-0 text-sm text-brand-800/70 dark:text-brand-200/60">
                  {fieldLabels.get(key) ?? humanizeKey(key)}
                </dt>
                <dd
                  className="min-w-0 truncate text-right text-sm font-semibold text-brand-900 dark:text-brand-50"
                  title={value}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Card>
  );
}

function RequirementsChecklist({
  template,
  formData,
  uploadedFiles,
}: {
  template: Template | null;
  formData: Record<string, string>;
  uploadedFiles?: File[];
}) {
  const { t } = useTranslation('process');
  const hasFiles = (uploadedFiles?.length ?? 0) > 0;
  const hasFormData = Object.keys(formData).length > 0;

  return (
    <Card elevation="flat" className="p-4 bg-info/10 border-info/30 rounded-xl fade-in backdrop-blur-sm">
      <h4 className="text-sm font-medium text-info mb-3">{t('processor.requirements.title')}</h4>
      <div className="space-y-2">
        <div className="flex items-center space-x-2 text-sm">
          <CheckCircle2 className="w-4 h-4 text-success-foreground" />
          <span className="text-gray-300">{t('processor.requirements.engineReady')}</span>
        </div>
        <div className="flex items-center space-x-2 text-sm">
          {template ? (
            <CheckCircle2 className="w-4 h-4 text-success-foreground" />
          ) : (
            <div className="w-4 h-4 rounded-full border-2 border-gray-600" />
          )}
          <span className={template ? 'text-gray-300' : 'text-gray-500'}>
            {t('processor.requirements.selectTemplate')}
          </span>
        </div>
        {template?.hasForm && (
          <div className="flex items-center space-x-2 text-sm">
            {hasFormData ? (
              <CheckCircle2 className="w-4 h-4 text-success-foreground" />
            ) : (
              <div className="w-4 h-4 rounded-full border-2 border-gray-600" />
            )}
            <span className={hasFormData ? 'text-gray-300' : 'text-gray-500'}>
              {t('processor.requirements.fillForm')}
            </span>
          </div>
        )}
        <div className="flex items-center space-x-2 text-sm">
          {hasFiles ? (
            <CheckCircle2 className="w-4 h-4 text-success-foreground" />
          ) : (
            <div className="w-4 h-4 rounded-full border-2 border-gray-600" />
          )}
          <span className={hasFiles ? 'text-gray-300' : 'text-gray-500'}>{t('processor.requirements.uploadFile')}</span>
        </div>
      </div>
    </Card>
  );
}

function ProcessingTips() {
  const { t } = useTranslation('process');

  return (
    <Card elevation="flat" className="p-4 bg-success/10 border-success/30 rounded-xl fade-in backdrop-blur-sm">
      <h4 className="text-sm font-semibold text-success-foreground mb-2 flex items-center gap-2">
        <Lightbulb className="w-4 h-4" />
        {t('processor.tips.title')}
      </h4>
      <ul className="text-sm text-success-foreground/80 space-y-1">
        <li>• {t('processor.tips.keepTabActive')}</li>
        <li>• {t('processor.tips.largerFiles')}</li>
        <li>• {t('processor.tips.monitorProgress')}</li>
        <li>• {t('processor.tips.inBrowser')}</li>
      </ul>
    </Card>
  );
}

export const VideoProcessor = ({
  isProcessing,
  canProcess,
  onStartProcessing,
  onCancelProcessing,
  error,
  template,
  formData,
  uploadedFiles,
}: VideoProcessorProps) => {
  const [isOptimisticProcessing, setIsOptimisticProcessing] = useState(false);

  const handleStartProcessing = () => {
    startTransition(() => {
      setIsOptimisticProcessing(true);
    });

    onStartProcessing();

    setTimeout(() => {
      setIsOptimisticProcessing(false);
    }, 1000);
  };

  const handleCancelProcessing = () => {
    // Drop the optimistic flag immediately so the button flips back to "Start" the instant we stop.
    setIsOptimisticProcessing(false);
    onCancelProcessing();
  };

  const actuallyProcessing = isProcessing || isOptimisticProcessing;

  return (
    <div className="space-y-4">
      <StatusBar actuallyProcessing={actuallyProcessing} canProcess={canProcess} />

      {error && <ErrorDisplay error={error} />}

      <ActionButton
        canProcess={canProcess}
        actuallyProcessing={actuallyProcessing}
        isOptimisticProcessing={isOptimisticProcessing}
        onStartProcessing={handleStartProcessing}
        onCancelProcessing={handleCancelProcessing}
      />

      {template && <TemplateInfo template={template} formData={formData} />}

      {!canProcess && <RequirementsChecklist template={template} formData={formData} uploadedFiles={uploadedFiles} />}

      {canProcess && !actuallyProcessing && <ProcessingTips />}
    </div>
  );
};
