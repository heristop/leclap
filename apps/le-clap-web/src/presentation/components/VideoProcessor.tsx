import { useState, startTransition } from 'react';
import { Play, Square, AlertCircle, CheckCircle2, Loader2, FileText, Users, Lightbulb } from 'lucide-react';
import clsx from 'clsx';
import { type Template } from '@/services/templateService';
import { Button, Card } from '@/presentation/components/ui';

interface VideoProcessorProps {
  isProcessing: boolean;
  canProcess: boolean;
  onStartProcessing: () => void;
  error: string | null;
  template: Template | null;
  formData: Record<string, string>;
  uploadedFiles?: File[];
}

function getStatusLabel(actuallyProcessing: boolean, canProcess: boolean): string {
  if (actuallyProcessing) return 'Processing Video...';

  if (canProcess) return 'Ready to Process';

  return 'Setup Required';
}

function getStatusDescription(actuallyProcessing: boolean, canProcess: boolean): string {
  if (actuallyProcessing) return 'Please wait while we process your video';

  if (canProcess) return 'All requirements met. You can start processing.';

  return 'Please select a template and upload video files';
}

function StatusIcon({ actuallyProcessing, canProcess }: { actuallyProcessing: boolean; canProcess: boolean }) {
  // Spin the circular loader itself — not the square container (which would
  // rotate the rounded box into a wobbling diamond).
  if (actuallyProcessing) return <Loader2 className="w-5 h-5 animate-spin" />;

  if (canProcess) return <CheckCircle2 className="w-5 h-5" />;

  return <AlertCircle className="w-5 h-5" />;
}

function StatusBar({ actuallyProcessing, canProcess }: { actuallyProcessing: boolean; canProcess: boolean }) {
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
          <p className="text-sm font-medium text-foreground">{getStatusLabel(actuallyProcessing, canProcess)}</p>
          <p className="text-xs text-gray-400">{getStatusDescription(actuallyProcessing, canProcess)}</p>
        </div>
      </div>

      {/* Status Icon */}
      <div
        className={clsx(
          'p-2 rounded-lg transition-all duration-200',
          canProcess ? 'bg-success/20 text-success' : 'bg-[var(--color-error)]/20 text-[var(--color-error)]'
        )}
      >
        <StatusIcon actuallyProcessing={actuallyProcessing} canProcess={canProcess} />
      </div>
    </Card>
  );
}

function ErrorDisplay({ error }: { error: string }) {
  return (
    <Card
      elevation="flat"
      className="p-4 bg-[var(--color-error)]/10 border-[var(--color-error)]/30 rounded-xl fade-in backdrop-blur-sm"
    >
      <div className="flex items-start space-x-3">
        <AlertCircle className="w-5 h-5 text-[var(--color-error)] mt-0.5 flex-shrink-0" />
        <div>
          <h4 className="text-sm font-medium text-[var(--color-error)] mb-1">Processing Error</h4>
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
}: {
  canProcess: boolean;
  actuallyProcessing: boolean;
  isOptimisticProcessing: boolean;
  onStartProcessing: () => void;
}) {
  return (
    <div className="flex justify-center">
      <Button
        variant="primary"
        size="lg"
        onClick={onStartProcessing}
        disabled={!canProcess || actuallyProcessing}
        className={clsx(
          'group px-8 py-4',
          canProcess && !actuallyProcessing && 'hover:scale-[1.03] active:scale-95',
          actuallyProcessing && 'cursor-wait opacity-95',
          isOptimisticProcessing && 'scale-95'
        )}
      >
        <span
          className={clsx(
            'p-2 rounded-lg transition-all duration-200 [&_svg]:size-6',
            canProcess && !actuallyProcessing ? 'bg-foreground/20' : 'bg-foreground/5',
            actuallyProcessing && 'animate-pulse'
          )}
        >
          {actuallyProcessing ? <Square /> : <Play />}
        </span>
        <span>{actuallyProcessing ? 'Processing...' : 'Start Processing'}</span>
      </Button>
    </div>
  );
}

function TemplateInfo({ template, formData }: { template: Template; formData: Record<string, string> }) {
  return (
    <Card elevation="flat" className="p-4 bg-brand-500/10 border-brand-500/30 rounded-xl fade-in backdrop-blur-sm">
      <div className="flex items-start space-x-3">
        <div className="p-2 bg-brand-500/20 rounded-lg border border-brand-500/20">
          {template.hasForm ? (
            <Users className="w-4 h-4 text-brand-700 dark:text-brand-300" />
          ) : (
            <FileText className="w-4 h-4 text-brand-700 dark:text-brand-300" />
          )}
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-medium text-brand-700 dark:text-brand-300 mb-1">
            Selected Template: {template.name}
          </h4>
          <p className="text-xs text-brand-800/70 dark:text-brand-200/70 mb-2">{template.description}</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-brand-800/70 dark:text-brand-400/70">Complexity:</span>
              <span className="ml-1 font-medium text-brand-700 dark:text-brand-300 capitalize">
                {template.complexity}
              </span>
            </div>
            <div>
              <span className="text-brand-800/70 dark:text-brand-400/70">Orientation:</span>
              <span className="ml-1 font-medium text-brand-700 dark:text-brand-300 capitalize">
                {template.orientation}
              </span>
            </div>
            <div>
              <span className="text-brand-800/70 dark:text-brand-400/70">Sections:</span>
              <span className="ml-1 font-medium text-brand-700 dark:text-brand-300">
                {template.descriptor.sections?.length ?? 0}
              </span>
            </div>
            <div>
              <span className="text-brand-800/70 dark:text-brand-400/70">Music:</span>
              <span className="ml-1 font-medium text-brand-700 dark:text-brand-300">
                {template.descriptor.global?.musicEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
          {template.hasForm && Object.keys(formData).length > 0 && (
            <div className="mt-2 pt-2 border-t border-brand-500/20">
              <p className="text-xs text-brand-800/70 dark:text-brand-400/70 mb-1">Form Data:</p>
              <div className="text-xs text-brand-700 dark:text-brand-300 space-y-1">
                {Object.entries(formData).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-brand-800/70 dark:text-brand-400/70">{key}:</span>
                    <span className="font-medium truncate ml-2" title={value}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
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
  const hasFiles = (uploadedFiles?.length ?? 0) > 0;
  const hasFormData = Object.keys(formData).length > 0;

  return (
    <Card elevation="flat" className="p-4 bg-info/10 border-info/30 rounded-xl fade-in backdrop-blur-sm">
      <h4 className="text-sm font-medium text-info mb-3">Before you can start processing:</h4>
      <div className="space-y-2">
        <div className="flex items-center space-x-2 text-sm">
          <CheckCircle2 className="w-4 h-4 text-success" />
          <span className="text-gray-300">Video processing engine ready</span>
        </div>
        <div className="flex items-center space-x-2 text-sm">
          {template ? (
            <CheckCircle2 className="w-4 h-4 text-success" />
          ) : (
            <div className="w-4 h-4 rounded-full border-2 border-gray-600" />
          )}
          <span className={template ? 'text-gray-300' : 'text-gray-500'}>Select a template</span>
        </div>
        {template?.hasForm && (
          <div className="flex items-center space-x-2 text-sm">
            {hasFormData ? (
              <CheckCircle2 className="w-4 h-4 text-success" />
            ) : (
              <div className="w-4 h-4 rounded-full border-2 border-gray-600" />
            )}
            <span className={hasFormData ? 'text-gray-300' : 'text-gray-500'}>Fill template form</span>
          </div>
        )}
        <div className="flex items-center space-x-2 text-sm">
          {hasFiles ? (
            <CheckCircle2 className="w-4 h-4 text-success" />
          ) : (
            <div className="w-4 h-4 rounded-full border-2 border-gray-600" />
          )}
          <span className={hasFiles ? 'text-gray-300' : 'text-gray-500'}>Upload at least one video file</span>
        </div>
      </div>
    </Card>
  );
}

function ProcessingTips() {
  return (
    <Card elevation="flat" className="p-4 bg-success/10 border-success/30 rounded-xl fade-in backdrop-blur-sm">
      <h4 className="text-sm font-semibold text-success mb-2 flex items-center gap-2">
        <Lightbulb className="w-4 h-4" />
        Processing Tips
      </h4>
      <ul className="text-sm text-success/80 space-y-1">
        <li>• Keep this tab active during processing</li>
        <li>• Larger files will take longer to process</li>
        <li>• You can monitor progress in real-time</li>
        <li>• Processing happens entirely in your browser</li>
      </ul>
    </Card>
  );
}

export const VideoProcessor = ({
  isProcessing,
  canProcess,
  onStartProcessing,
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
      />

      {template && <TemplateInfo template={template} formData={formData} />}

      {!canProcess && <RequirementsChecklist template={template} formData={formData} uploadedFiles={uploadedFiles} />}

      {canProcess && !actuallyProcessing && <ProcessingTips />}
    </div>
  );
};
