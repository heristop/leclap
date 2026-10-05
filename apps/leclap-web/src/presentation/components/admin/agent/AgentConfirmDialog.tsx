import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { ConfirmRequest } from '@/application/usecases/webmcp/types';
import { ConfirmDialog } from '../confirm-dialog';
import type { BuilderAgent } from './use-builder-agent';

// The head of the browser agent's confirmation queue, as the shell's one overlay ('agent'). Cancel takes
// the initial focus, Escape and dismissal decline, and the agent hears `user_declined`. The agent's own
// note is shown as plain text, after the page's wording of what will happen — never instead of it.

function describe(request: ConfirmRequest, t: TFunction<'agent'>): string {
  const action = t(`actions.${request.tool as 'edit_template'}`);
  const parts = [t('confirm.description', { action })];

  if (request.kind === 'edit') parts.push(t('confirm.undoable'));

  if (request.note) parts.push(t('log.note', { note: request.note }));

  return parts.join(' ');
}

export const AgentConfirmDialog = ({ agent }: { agent: Pick<BuilderAgent, 'confirm' | 'answer'> }) => {
  const { t } = useTranslation('agent');
  const pending = agent.confirm;

  return (
    <ConfirmDialog
      open={pending !== null}
      title={t('confirm.title')}
      description={pending ? describe(pending.request, t) : ''}
      cancelLabel={t('confirm.deny')}
      confirmLabel={t('confirm.allow')}
      tone={pending?.request.kind === 'consequential' ? 'danger' : 'primary'}
      onConfirm={() => {
        if (pending) agent.answer(pending.id, true);
      }}
      onCancel={() => {
        if (pending) agent.answer(pending.id, false);
      }}
    />
  );
};
