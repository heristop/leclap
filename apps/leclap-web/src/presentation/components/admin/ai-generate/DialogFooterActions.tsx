// The dialog's single primary action changes with the run: Generate → Cancel while working → Write
// template on a plan under review → Open in builder when ready → Replace draft (with the reason
// spelled out) when that would replace edits.
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowRight, Sparkles } from '@/presentation/components/icons';
import type { ReactNode } from 'react';
import { Button, DialogFooter } from '@/presentation/components/ui';
import { isRunning, type RunStatus } from './ai-generation.logic';

interface DialogFooterActionsProps {
  status: RunStatus;
  confirming: boolean;
  canGenerate: boolean;
  // The live status (progress, errors), rendered inside the pinned footer.
  statusSlot?: ReactNode;
  // Why Generate is disabled, shown beside it (a disabled button never goes unexplained).
  blockedReason?: string;
  onGenerate: () => void;
  onCancel: () => void;
  onOpen: () => void;
  onConfirmReplace: () => void;
  onKeepEditing: () => void;
  onRegenerate: () => void;
  // The plan review step: continue to the template (disabled while the plan is incomplete).
  onWritePlan?: () => void;
  canWritePlan?: boolean;
}

// Pinned to the bottom of the scrolling sheet so the primary action is always in reach.
// The run's status sits here too, beside the action that started it, so progress and errors are
// visible however far the form is scrolled.
const FooterBar = ({ status, children }: { status?: ReactNode; children: ReactNode }) => (
  <div className="sticky -bottom-6 z-10 -mx-6 -mb-6 mt-6 grid gap-3 rounded-b-2xl border-t border-divider bg-surface px-6 py-4">
    {status}
    {children}
  </div>
);

const ReplaceConfirm = ({
  onKeepEditing,
  onConfirmReplace,
}: Pick<DialogFooterActionsProps, 'onKeepEditing' | 'onConfirmReplace'>) => {
  const { t } = useTranslation('ai');

  return (
    <FooterBar>
      <p role="alert" className="flex items-start gap-2 text-sm text-pretty text-foreground">
        <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-[var(--color-warning)]" />
        {t('result.replaceWarning')}
      </p>
      <DialogFooter className="mt-0">
        <Button variant="ghost" onClick={onKeepEditing}>
          {t('actions.keep')}
        </Button>
        <Button onClick={onConfirmReplace}>{t('actions.replace')}</Button>
      </DialogFooter>
    </FooterBar>
  );
};

export const DialogFooterActions = (props: DialogFooterActionsProps) => {
  const { t } = useTranslation('ai');
  const { status } = props;

  if (props.confirming) {
    return <ReplaceConfirm onKeepEditing={props.onKeepEditing} onConfirmReplace={props.onConfirmReplace} />;
  }

  if (isRunning(status)) {
    return (
      <FooterBar status={props.statusSlot}>
        <DialogFooter className="mt-0">
          <Button variant="secondary" onClick={props.onCancel}>
            {t('actions.cancel')}
          </Button>
        </DialogFooter>
      </FooterBar>
    );
  }

  if (status.kind === 'plan-ready') {
    return (
      <FooterBar status={props.statusSlot}>
        <DialogFooter className="mt-0">
          <Button variant="ghost" onClick={props.onRegenerate}>
            {t('actions.startOver')}
          </Button>
          <Button disabled={props.canWritePlan === false} onClick={props.onWritePlan}>
            {t('actions.writeTemplate')}
            <ArrowRight aria-hidden />
          </Button>
        </DialogFooter>
      </FooterBar>
    );
  }

  if (status.kind === 'ready') {
    return (
      <FooterBar status={props.statusSlot}>
        <DialogFooter className="mt-0">
          <Button variant="ghost" onClick={props.onRegenerate}>
            {t('actions.regenerate')}
          </Button>
          <Button onClick={props.onOpen}>
            {t('actions.open')}
            <ArrowRight aria-hidden />
          </Button>
        </DialogFooter>
      </FooterBar>
    );
  }

  return (
    <FooterBar status={props.statusSlot}>
      <DialogFooter className="mt-0 sm:items-center">
        {!props.canGenerate && props.blockedReason && (
          <p className="text-xs text-muted-foreground sm:mr-auto">{props.blockedReason}</p>
        )}
        <Button disabled={!props.canGenerate} onClick={props.onGenerate}>
          <Sparkles aria-hidden />
          {status.kind === 'error' ? t('actions.retry') : t('actions.generate')}
        </Button>
      </DialogFooter>
    </FooterBar>
  );
};
