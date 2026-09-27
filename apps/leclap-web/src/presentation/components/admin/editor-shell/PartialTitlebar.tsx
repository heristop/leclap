import type { TFunction } from 'i18next';
import { ArrowLeft, Save, Trash2 } from '@/presentation/components/icons';
import { PlusIcon } from '@/presentation/components/icons/plus';
import { CopyIcon } from '@/presentation/components/icons/copy';
import { Badge } from '@/presentation/components/ui';
import { Select, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/select';
import { useIconHover } from '@/presentation/components/icons/useIconHover';
import type { AvailablePartial } from '@/services/templatePartialService';
import { EditorSelectContent } from '../editor/editor-select-content';

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
  onDuplicate: () => void;
  onBack: () => void;
  t: TFunction<'admin'>;
}

const ActionButton = ({
  label,
  onClick,
  disabled,
  hoverProps,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  hoverProps?: { onMouseEnter: () => void; onMouseLeave: () => void };
  children: React.ReactNode;
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    disabled={disabled}
    onClick={onClick}
    className="tap grid size-9 shrink-0 place-items-center rounded-lg border border-foreground/10 bg-foreground/5 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:pointer-events-none disabled:opacity-40"
    {...hoverProps}
  >
    {children}
  </button>
);

// The picker's id, so the shell can hand focus back to it after a delete.
export const PARTIAL_PICKER_ID = 'partial-picker';

const PRIMARY =
  'tap inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-brand-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50';

// The partial editor's top bar: a back pill to /templates, the partial picker (local and built-in
// partials), the id field while the draft is still new, a Built-in badge, then New / Delete and the
// primary action. A built-in can't be saved, so its primary is "Duplicate & edit" — an editable local
// copy — rather than a greyed-out Save. Once saved (or built-in) the picker names the partial, so the id
// field steps aside instead of repeating it. On phones the actions drop to their own right-aligned row.
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
  onDuplicate,
  onBack,
  t,
}: PartialTitlebarProps) => {
  const { ref: plusRef, hoverProps: plusHoverProps } = useIconHover();
  const { ref: copyRef, hoverProps: copyHoverProps } = useIconHover();
  const idEditable = !readonly && !idLocked;

  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-foreground/10 bg-surface-2/50 px-4 py-2 sm:flex-nowrap sm:gap-3 sm:px-6">
      <button
        type="button"
        onClick={onBack}
        aria-label={t('editor.back')}
        className="tap group inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 sm:px-3"
      >
        <ArrowLeft className="size-4 transition-transform duration-300 group-hover:-translate-x-1 motion-reduce:transition-none" />
        <span className="hidden sm:inline">{t('editor.back')}</span>
      </button>

      <div className={idEditable ? 'w-40 shrink-0 sm:w-48' : 'min-w-0 flex-1 sm:max-w-64'}>
        <Select value={selected?.id ?? ''} onValueChange={onPick}>
          <SelectTrigger id={PARTIAL_PICKER_ID} aria-label={t('shell.partialPicker')} className="h-9">
            <SelectValue placeholder={t('shell.partialPicker')} />
          </SelectTrigger>
          <EditorSelectContent>
            {partials.map((partial) => (
              <SelectItem key={partial.id} value={partial.id}>
                {partial.id}
              </SelectItem>
            ))}
          </EditorSelectContent>
        </Select>
      </div>

      {idEditable && (
        <input
          type="text"
          value={id}
          onChange={(e) => {
            onIdChange(e.target.value);
          }}
          placeholder="local:intro"
          aria-label={t('shell.partialNameLabel')}
          spellCheck={false}
          className="-mx-1.5 min-w-0 flex-1 basis-24 truncate rounded-md bg-transparent px-1.5 py-0.5 font-display text-base font-bold text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 hover:bg-foreground/5 focus:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-brand-500/40"
        />
      )}

      {readonly && (
        <Badge variant="neutral" className="shrink-0">
          {t('shell.partialBuiltin')}
        </Badge>
      )}

      {/* Action cluster — `w-full` forces the wrap onto its own right-aligned row on phones. */}
      <div className="flex w-full items-center justify-end gap-2 sm:ml-auto sm:w-auto sm:gap-3">
        <ActionButton label={t('shell.partialNew')} onClick={onNew} hoverProps={plusHoverProps}>
          <PlusIcon ref={plusRef} size={16} />
        </ActionButton>
        <ActionButton label={t('shell.partialDelete')} onClick={onDelete} disabled={selected?.source !== 'local'}>
          <Trash2 className="size-4" />
        </ActionButton>
        {readonly ? (
          <button type="button" onClick={onDuplicate} className={PRIMARY} {...copyHoverProps}>
            <CopyIcon ref={copyRef} size={16} />
            {t('card.duplicate')}
          </button>
        ) : (
          <button type="button" onClick={onSave} className={PRIMARY}>
            <Save className="size-4" />
            {t('shell.partialSave')}
          </button>
        )}
      </div>
    </header>
  );
};
