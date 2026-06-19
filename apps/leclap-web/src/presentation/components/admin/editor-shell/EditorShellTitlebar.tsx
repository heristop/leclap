import type { ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { ArrowLeft, Undo2, Redo2, Save } from '@/presentation/components/icons';

interface EditorShellTitlebarProps {
  name: string;
  onNameChange: (name: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onCancel: () => void;
  onSave: () => void;
  saveDisabled: boolean;
  // Optional control rendered just before Save — the template editor passes its "Preview render" button.
  preview?: ReactNode;
  t: TFunction<'admin'>;
}

const IconButton = ({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
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

// The editor shell's top bar: a back/Cancel pill, the template name, undo/redo, and a primary Save
// (disabled while the save guard fails). Mirrors the studio EditorTopBar look.
export const EditorShellTitlebar = ({
  name,
  onNameChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onCancel,
  onSave,
  saveDisabled,
  preview,
  t,
}: EditorShellTitlebarProps) => (
  <header className="flex shrink-0 items-center gap-2 border-b border-foreground/10 bg-surface-2/50 px-3 py-2 sm:gap-3">
    <button
      type="button"
      onClick={onCancel}
      aria-label={t('editor.back')}
      className="tap group inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 sm:px-3"
    >
      <ArrowLeft className="size-4 transition-transform duration-300 group-hover:-translate-x-1 motion-reduce:transition-none" />
      <span className="hidden sm:inline">{t('editor.back')}</span>
    </button>
    {/* Inline-editable template name — click to rename right in the titlebar. */}
    <input
      type="text"
      value={name}
      onChange={(e) => {
        onNameChange(e.target.value);
      }}
      placeholder={t('editor.untitled')}
      aria-label={t('shell.nameLabel')}
      className="-mx-1.5 min-w-0 flex-1 truncate rounded-md bg-transparent px-1.5 py-0.5 font-display text-base font-bold text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 hover:bg-foreground/5 focus:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-brand-500/40"
    />
    <IconButton label={t('editor.toolbar.undo')} disabled={!canUndo} onClick={onUndo}>
      <Undo2 className="size-4" />
    </IconButton>
    <IconButton label={t('editor.toolbar.redo')} disabled={!canRedo} onClick={onRedo}>
      <Redo2 className="size-4" />
    </IconButton>
    {preview}
    <button
      type="button"
      onClick={onSave}
      disabled={saveDisabled}
      aria-label={t('editor.save')}
      className="tap inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
    >
      <Save className="size-4" />
      <span className="hidden sm:inline">{t('editor.save')}</span>
    </button>
  </header>
);
