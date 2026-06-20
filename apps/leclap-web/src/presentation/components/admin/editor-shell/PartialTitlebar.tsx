import type { TFunction } from 'i18next';
import { ArrowLeft, Plus, Save, Trash2 } from '@/presentation/components/icons';
import { Badge } from '@/presentation/components/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/select';
import type { AvailablePartial } from '@/services/templatePartialService';

interface PartialTitlebarProps {
  id: string;
  selected: AvailablePartial | null;
  partials: AvailablePartial[];
  readonly: boolean;
  idLocked: boolean;
  onIdChange: (id: string) => void;
  onPick: (partialId: string) => void;
  onNew: () => void;
  onDelete: () => void;
  onSave: () => void;
  onBack: () => void;
  t: TFunction<'admin'>;
}

const ActionButton = ({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    disabled={disabled}
    onClick={onClick}
    className="tap grid size-9 shrink-0 place-items-center rounded-lg border border-foreground/10 bg-foreground/5 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:pointer-events-none disabled:opacity-40"
  >
    {children}
  </button>
);

// The partial editor's top bar: a back pill to /templates, a partial picker (Select listing
// Local/Built-in partials), the inline-editable id (disabled for built-ins or local-locked ids),
// a Built-in badge for read-only partials, plus New / Delete / Save actions. Mirrors the template
// editor's titlebar look while owning the partial-specific switch/new/delete affordances.
export const PartialTitlebar = ({
  id,
  selected,
  partials,
  readonly,
  idLocked,
  onIdChange,
  onPick,
  onNew,
  onDelete,
  onSave,
  onBack,
  t,
}: PartialTitlebarProps) => (
  <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-foreground/10 bg-surface-2/50 px-3 py-2 sm:gap-3">
    <button
      type="button"
      onClick={onBack}
      aria-label={t('editor.back')}
      className="tap group inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 sm:px-3"
    >
      <ArrowLeft className="size-4 transition-transform duration-300 group-hover:-translate-x-1 motion-reduce:transition-none" />
      <span className="hidden sm:inline">{t('editor.back')}</span>
    </button>

    <div className="w-40 shrink-0 sm:w-48">
      <Select value={selected?.id ?? ''} onValueChange={onPick}>
        <SelectTrigger aria-label={t('shell.partialPicker')} className="h-9">
          <SelectValue placeholder={t('shell.partialPicker')} />
        </SelectTrigger>
        <SelectContent>
          {partials.map((partial) => (
            <SelectItem key={partial.id} value={partial.id}>
              {partial.id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    <input
      type="text"
      value={id}
      disabled={idLocked}
      onChange={(e) => {
        onIdChange(e.target.value);
      }}
      placeholder="local:intro"
      aria-label={t('shell.partialNameLabel')}
      className="-mx-1.5 min-w-0 flex-1 truncate rounded-md bg-transparent px-1.5 py-0.5 font-display text-base font-bold text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 hover:bg-foreground/5 focus:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:opacity-60"
    />

    {readonly && (
      <Badge variant="neutral" className="shrink-0">
        {t('shell.partialBuiltin')}
      </Badge>
    )}

    <ActionButton label={t('shell.partialNew')} onClick={onNew}>
      <Plus className="size-4" />
    </ActionButton>
    <ActionButton label={t('shell.partialDelete')} onClick={onDelete} disabled={selected?.source !== 'local'}>
      <Trash2 className="size-4" />
    </ActionButton>
    <button
      type="button"
      onClick={onSave}
      disabled={readonly}
      aria-label={t('editor.save')}
      className="tap inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
    >
      <Save className="size-4" />
      <span className="hidden sm:inline">{t('editor.save')}</span>
    </button>
  </header>
);
