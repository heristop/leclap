// "Generate with AI": a focused sheet over the builder. Describe the video, optionally let Jev read
// the brief, then generate with your own provider key. The result opens as a new draft through the
// editor history (one Undo brings the previous draft back); replacing a draft with edits asks first.
// Lazy-loaded by the shell, so the prompt material (schema, samples, catalog) loads only on open.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Orientation } from '@/application/usecases/ai-template/system-prompt';
import { findProvider } from '@/infrastructure/ai/registry';
import { JEV_KEY_ID } from '@/infrastructure/ai/typesafe-jev';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/presentation/components/ui';
import type { EditorState } from '../templateEditorModel';
import { canGenerate, isRunning } from './ai-generation.logic';
import { BriefFields } from './BriefFields';
import { DialogFooterActions } from './DialogFooterActions';
import { GenerationStatus } from './GenerationStatus';
import { JevPanel } from './JevPanel';
import { ProviderSettings } from './ProviderSettings';
import { ResultCard } from './ResultCard';
import { generatedToEditorState, needsReplaceConfirmation } from './load-generated';
import { effectiveHints, preferredSamples, routeChips, type RouteChip, type RouteOverrides } from './route-decisions';
import { useAiGeneration } from './use-ai-generation';
import { useApiKey } from './use-api-key';

export interface GenerateWithAiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // The current draft has edits (Undo is available): replacing it asks first.
  hasUnsavedWork: boolean;
  onLoad: (state: EditorState) => void;
}

function useBriefState() {
  const [brief, setBrief] = useState('');
  const [orientation, setOrientation] = useState<Orientation | 'auto'>('auto');
  const [duration, setDuration] = useState('auto');
  const [providerId, setProviderId] = useState('anthropic');
  const [models, setModels] = useState<Record<string, string>>({});
  const [overrides, setOverrides] = useState<RouteOverrides>({});
  const provider = findProvider(providerId);

  return {
    brief,
    setBrief,
    orientation,
    setOrientation,
    duration,
    setDuration,
    provider,
    setProviderId,
    model: models[provider.id] ?? provider.defaultModel,
    setModel: (model: string) => {
      setModels((current) => ({ ...current, [provider.id]: model }));
    },
    overrides,
    toggle: (chip: RouteChip) => {
      setOverrides((current) => ({ ...current, [chip.field]: !chip.on }));
    },
    resetOverrides: () => {
      setOverrides({});
    },
  };
}

const GenerateWithAiDialog = ({ open, onOpenChange, hasUnsavedWork, onLoad }: GenerateWithAiDialogProps) => {
  const { t } = useTranslation('ai');
  const form = useBriefState();
  const run = useAiGeneration();
  const { key } = useApiKey(form.provider.id);
  const jev = useApiKey(JEV_KEY_ID);
  const [pending, setPending] = useState<EditorState | null>(null);
  const chips = run.route.kind === 'ready' ? routeChips(run.route.route, form.overrides) : [];
  const running = isRunning(run.status) || run.route.kind === 'routing';
  const userHints = {
    orientation: form.orientation,
    durationSeconds: form.duration === 'auto' ? null : Number(form.duration),
  };

  const close = (): void => {
    run.cancel();
    setPending(null);
    onOpenChange(false);
  };

  const load = (state: EditorState): void => {
    if (needsReplaceConfirmation(hasUnsavedWork) && pending === null) {
      setPending(state);

      return;
    }
    onLoad(state);
    run.reset();
    close();
  };

  const generate = async (): Promise<void> => {
    const route = run.route.kind === 'none' && jev.key ? await run.analyse(form.brief, jev.key) : null;
    const routed = route ? routeChips(route, {}) : chips;
    await run.generate({
      provider: form.provider,
      model: form.model.trim() || form.provider.defaultModel,
      apiKey: key,
      brief: form.brief,
      hints: effectiveHints(routed, userHints),
      preferSampleIds: preferredSamples(routed),
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle className="pr-10">{t('title')}</DialogTitle>
          <DialogDescription className="text-pretty">{t('subtitle')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6">
          <BriefFields
            brief={form.brief}
            onBriefChange={(value) => {
              form.setBrief(value);
              form.resetOverrides();
              run.clearRoute();
            }}
            orientation={form.orientation}
            onOrientationChange={form.setOrientation}
            duration={form.duration}
            onDurationChange={form.setDuration}
            disabled={running}
          />
          <JevPanel
            hasKey={jev.key !== ''}
            brief={form.brief}
            route={run.route}
            chips={chips}
            onToggle={form.toggle}
            onAnalyse={() => {
              run.analyse(form.brief, jev.key).catch(() => {});
            }}
            onStartFromMatch={load}
            disabled={running}
          />
          <ProviderSettings
            provider={form.provider}
            model={form.model}
            onProviderChange={form.setProviderId}
            onModelChange={form.setModel}
          />
          {run.status.kind === 'ready' && (
            <ResultCard summary={run.status.summary} warnings={run.status.result.warnings} />
          )}
        </div>
        <DialogFooterActions
          status={run.status}
          confirming={pending !== null}
          canGenerate={canGenerate(form.brief, key, run.status) && run.route.kind !== 'routing'}
          statusSlot={<GenerationStatus status={run.status} providerLabel={form.provider.label} />}
          blockedReason={key ? t('footer.needBrief') : t('footer.needKey', { provider: form.provider.label })}
          onGenerate={() => {
            generate().catch(() => {});
          }}
          onCancel={run.cancel}
          onOpen={() => {
            if (run.status.kind === 'ready') load(generatedToEditorState(run.status.result.descriptor, t('title')));
          }}
          onConfirmReplace={() => {
            if (pending) {
              onLoad(pending);
              run.reset();
              close();
            }
          }}
          onKeepEditing={() => {
            setPending(null);
          }}
          onRegenerate={() => {
            setPending(null);
            run.reset();
          }}
        />
      </DialogContent>
    </Dialog>
  );
};

export default GenerateWithAiDialog;
