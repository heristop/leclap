import { useId, useState, type CSSProperties } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Bot, Undo2, X } from '@/presentation/components/icons';
import { cn } from '@/lib/utils';
import { entryTime, type ActivityEntry, type PillState } from './agent-activity.logic';
import type { BuilderAgent } from './use-builder-agent';

// The titlebar's browser-agent pill and its activity popover: what the agent is doing (off / ready /
// working), the two settings, and the recent calls, newest first, each with its outcome in words (never
// colour alone) and, for an edit that is still the present state, an Undo. The popover is non-modal so
// the timeline highlights stay visible and usable behind it. A polite live region outside it announces
// a summary once the agent pauses. Agent-written notes render as plain text.

const DOT: Record<PillState, string> = {
  off: 'bg-muted-foreground/50',
  idle: 'bg-[var(--color-success)]',
  working: 'bg-brand-400 motion-safe:animate-pulse',
};

interface SwitchRowProps {
  label: string;
  help: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

const SwitchRow = ({ label, help, checked, disabled = false, onChange }: SwitchRowProps) => {
  const labelId = useId();
  const helpId = useId();

  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <p id={labelId} className={cn('text-sm font-medium text-foreground', disabled && 'opacity-50')}>
          {label}
        </p>
        <p id={helpId} className="text-xs text-muted-foreground">
          {help}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={helpId}
        disabled={disabled}
        onClick={() => {
          onChange(!checked);
        }}
        className={cn(
          'tap relative mt-0.5 inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 disabled:opacity-40',
          checked ? 'border-brand-500 bg-brand-500' : 'border-foreground/20 bg-foreground/10'
        )}
      >
        <span
          aria-hidden
          className={cn(
            'size-4.5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none',
            checked ? 'translate-x-[1.1rem]' : 'translate-x-0.5'
          )}
        />
      </button>
    </div>
  );
};

const STATUS_TONE: Record<ActivityEntry['status'], string> = {
  ok: 'text-[var(--color-success)]',
  error: 'text-[var(--color-error)]',
  declined: 'text-[var(--color-warning)]',
};

interface EntryRowProps {
  entry: ActivityEntry;
  canUndo: boolean;
  onUndo: () => void;
  t: TFunction<'agent'>;
  locale: string;
}

const EntryRow = ({ entry, canUndo, onUndo, t, locale }: EntryRowProps) => {
  const action = t(`tools.${entry.tool}`);
  const status = t(`log.status.${entry.status}`);
  const reason = entry.code ? t(`errors.${entry.code}`) : null;

  return (
    <li className="flex items-start gap-3 border-t border-foreground/10 py-2.5 first:border-t-0">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-medium text-foreground">{action}</span>
          <span className={cn('text-xs font-semibold', STATUS_TONE[entry.status])}>
            {status}
            {reason ? ` · ${reason}` : ''}
          </span>
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {entryTime(entry.at, locale)}
          {entry.changed.length > 0 ? ` · ${t('log.changed', { count: entry.changed.length })}` : ''}
        </p>
        {entry.note ? (
          <p className="mt-0.5 break-words text-xs text-muted-foreground">{t('log.note', { note: entry.note })}</p>
        ) : null}
      </div>
      {canUndo ? (
        <button
          type="button"
          onClick={onUndo}
          aria-label={t('log.undoLabel', { action })}
          className="tap inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-foreground/15 px-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
        >
          <Undo2 aria-hidden className="size-3.5" />
          {t('log.undo')}
        </button>
      ) : null}
    </li>
  );
};

const ActivityLog = ({ agent, t, locale }: { agent: BuilderAgent; t: TFunction<'agent'>; locale: string }) => {
  if (agent.entries.length === 0) {
    return <p className="py-3 text-sm text-muted-foreground">{t('log.empty')}</p>;
  }

  return (
    <ol aria-label={t('log.title')} className="max-h-[min(22rem,45dvh)] overflow-y-auto overscroll-contain pr-1">
      {agent.entries.map((entry) => (
        <EntryRow
          key={entry.id}
          entry={entry}
          canUndo={agent.canUndo(entry)}
          onUndo={() => {
            agent.undo(entry);
          }}
          t={t}
          locale={locale}
        />
      ))}
    </ol>
  );
};

const LiveRegion = ({ agent, t }: { agent: BuilderAgent; t: TFunction<'agent'> }) => (
  <p role="status" aria-live="polite" className="sr-only">
    {agent.live ? <span key={agent.live.id}>{t(`live.${agent.live.key}`, { count: agent.live.count })}</span> : null}
  </p>
);

export const AgentActivity = ({ agent }: { agent: BuilderAgent }) => {
  const { t, i18n } = useTranslation('agent');
  const [open, setOpen] = useState(false);
  // The popover hangs under the pill: its bottom edge, and (from `sm` up) its right edge.
  const [anchor, setAnchor] = useState({ top: 72, right: 24 });

  if (!agent.available) return null;

  const stateLabel = t(`pill.states.${agent.state}`);

  return (
    <>
      <DialogPrimitive.Root open={open} onOpenChange={setOpen} modal={false}>
        <DialogPrimitive.Trigger asChild>
          <button
            type="button"
            data-agent-pill={agent.state}
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setAnchor({
                top: Math.round(rect.bottom + 8),
                right: Math.max(12, Math.round(window.innerWidth - rect.right)),
              });
            }}
            aria-label={t('pill.aria', { state: stateLabel })}
            title={t('pill.aria', { state: stateLabel })}
            className="tap inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-foreground/15 bg-foreground/5 px-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 sm:px-3"
          >
            <span className="relative">
              <Bot aria-hidden className="size-4" />
              <span
                aria-hidden
                className={cn('absolute -right-1 -top-1 size-2 rounded-full ring-2 ring-surface', DOT[agent.state])}
              />
            </span>
            <span className="hidden lg:inline">{t('pill.label')}</span>
          </button>
        </DialogPrimitive.Trigger>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Content
            style={
              {
                '--agent-top': `${String(anchor.top)}px`,
                '--agent-right': `${String(anchor.right)}px`,
              } as CSSProperties
            }
            className="rise-in fixed inset-x-3 top-[var(--agent-top)] z-[57] max-h-[calc(100dvh-var(--agent-top)-1rem)] overflow-y-auto rounded-2xl border border-divider bg-surface p-4 text-foreground shadow-[var(--shadow-lg)] focus:outline-none sm:inset-x-auto sm:right-[var(--agent-right)] sm:w-[24rem]"
          >
            <div className="flex items-start justify-between gap-3">
              <DialogPrimitive.Title className="flex items-center gap-2 font-display text-lg font-bold">
                <Bot aria-hidden className="size-5 text-brand-400" />
                {t('popover.title')}
              </DialogPrimitive.Title>
              <DialogPrimitive.Close
                aria-label={t('popover.close')}
                className="tap -mr-1 -mt-1 grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
              >
                <X className="size-4" />
              </DialogPrimitive.Close>
            </div>
            <DialogPrimitive.Description className="mt-1 text-pretty text-sm text-muted-foreground">
              {t('popover.intro')}
            </DialogPrimitive.Description>
            {agent.support === 'polyfill' ? (
              <p className="mt-2 rounded-lg bg-foreground/5 px-2.5 py-1.5 text-xs text-muted-foreground">
                {t('popover.polyfill')}
              </p>
            ) : null}
            <div className="mt-2 divide-y divide-foreground/10">
              <SwitchRow
                label={t('settings.enabled')}
                help={t('settings.enabledHelp')}
                checked={agent.settings.enabled}
                onChange={(enabled) => {
                  agent.setSettings({ enabled });
                }}
              />
              <SwitchRow
                label={t('settings.askBeforeEdit')}
                help={t('settings.askBeforeEditHelp')}
                checked={agent.settings.askBeforeEdit}
                disabled={!agent.settings.enabled}
                onChange={(askBeforeEdit) => {
                  agent.setSettings({ askBeforeEdit });
                }}
              />
            </div>
            {agent.problem ? (
              <p role="status" className="mt-2 text-xs text-[var(--color-warning)]">
                {t('settings.problem', { detail: agent.problem })}
              </p>
            ) : null}
            <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('log.title')}
            </h3>
            <ActivityLog agent={agent} t={t} locale={i18n.language} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      <LiveRegion agent={agent} t={t} />
    </>
  );
};
