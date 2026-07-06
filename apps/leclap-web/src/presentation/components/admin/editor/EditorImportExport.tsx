// JSON import / export controls for the studio shell's Advanced panel. Mirrors TemplateEditor's
// EditorToolbar import/export exactly: export downloads the built descriptor JSON; import reads a
// picked file, validates it via templateIO, and on success replaces the editor state. Import failures
// are surfaced inline (the shell has no separate error dialog for this panel).
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from '@/presentation/components/icons';
import { DownloadIcon } from '@/presentation/components/icons/download';
import { UploadIcon } from '@/presentation/components/icons/upload';
import type { EditorState } from '../templateEditorModel';
import { FieldGroupHeader } from './FieldGroupHeader';
import { exportDescriptorJson, exportFilename, importDescriptorJson } from './templateIO';

interface EditorImportExportProps {
  state: EditorState;
  onImport: (next: EditorState) => void;
}

// Trigger a client-side download of `text` as a JSON file named `filename`.
function downloadText(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export const EditorImportExport = ({ state, onImport }: EditorImportExportProps) => {
  const { t } = useTranslation('admin');
  const fileRef = useRef<HTMLInputElement>(null);
  const [importErrors, setImportErrors] = useState<string[] | null>(null);
  const [imported, setImported] = useState(false);

  const exportJson = (): void => {
    downloadText(exportDescriptorJson(state), exportFilename(state));
  };

  const importJson = (text: string): void => {
    const result = importDescriptorJson(text, state);

    if (!result.ok) {
      setImported(false);
      setImportErrors(result.errors);

      return;
    }
    setImportErrors(null);
    setImported(true);
    onImport(result.state);
  };

  const onFile = async (file: File | undefined): Promise<void> => {
    if (!file) return;

    importJson(await file.text());

    // Reset so re-selecting the same file fires change again.
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="border-t border-foreground/10 pt-4">
      <FieldGroupHeader label={t('editor.advanced.io.label')} hint={t('editor.advanced.io.hint')} />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={exportJson}
          className="tap inline-flex items-center gap-1.5 rounded-lg bg-foreground/5 px-2.5 py-1.5 text-xs text-gray-600 transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 active:scale-[0.97] dark:text-gray-300"
        >
          <DownloadIcon size={14} /> {t('editor.toolbar.export')}
        </button>
        <button
          type="button"
          onClick={() => {
            fileRef.current?.click();
          }}
          className="tap inline-flex items-center gap-1.5 rounded-lg bg-foreground/5 px-2.5 py-1.5 text-xs text-gray-600 transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 active:scale-[0.97] dark:text-gray-300"
        >
          <UploadIcon size={14} /> {t('editor.toolbar.import')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(e) => {
            onFile(e.target.files?.[0]).catch(() => {});
          }}
        />
      </div>
      {/* Success confirmation (aria-live via role="status"): a silent state swap after picking a
          file reads as "nothing happened" — this closes the loop without stealing focus. */}
      {imported && !importErrors && (
        <p
          role="status"
          className="mt-3 flex items-center gap-1.5 rounded-lg border border-[var(--color-success)]/50 bg-[var(--color-success)]/15 p-2.5 text-xs font-medium text-[var(--color-success-foreground)]"
        >
          <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {t('editor.advanced.io.importSuccess')}
        </p>
      )}
      {importErrors && (
        <div
          role="alert"
          className="mt-3 rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 p-2.5 text-xs text-[var(--color-error)]"
        >
          <p className="font-semibold">{t('editor.importError.title')}</p>
          <ul className="mt-1 space-y-0.5">
            {importErrors.map((line, i) => (
              <li key={i} className="font-mono">
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
