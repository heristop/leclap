// Author-defined template constants. Each row is a {name, value} pair that buildDescriptor merges into
// global.variables; insertable as {{ name }} in any overlay text. Extracted from TemplateEditor so both
// the legacy editor and the studio shell's Variables panel render the exact same authoring UI.
import { useTranslation } from 'react-i18next';
import { Trash2, Plus } from '@/presentation/components/icons';
import type { EditorState } from '../templateEditorModel';
import { EDITOR_INPUT_CLASS } from './editorStyles';

interface GlobalVariablesEditorProps {
  state: EditorState;
  patch: (p: Partial<EditorState>) => void;
}

export const GlobalVariablesEditor = ({ state, patch }: GlobalVariablesEditorProps) => {
  const { t } = useTranslation('admin');
  const { globalVariables } = state;

  const update = (i: number, p: Partial<EditorState['globalVariables'][number]>) => {
    patch({ globalVariables: globalVariables.map((v, idx) => (idx === i ? { ...v, ...p } : v)) });
  };

  return (
    <div>
      <span className="block text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
        {t('editor.variables.label')}
      </span>
      <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">{t('editor.variables.hint')}</p>
      <div className="space-y-2">
        {globalVariables.map((variable, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-brand-600 dark:text-brand-300">
                #
              </span>
              <input
                aria-label={t('editor.variables.name', { index: i + 1 })}
                className={`${EDITOR_INPUT_CLASS} pl-7`}
                value={variable.name}
                onChange={(e) => {
                  update(i, { name: e.target.value });
                }}
                placeholder={t('editor.variables.namePlaceholder')}
              />
            </div>
            <input
              aria-label={t('editor.variables.value', { index: i + 1 })}
              className={EDITOR_INPUT_CLASS}
              value={variable.value}
              onChange={(e) => {
                update(i, { value: e.target.value });
              }}
              placeholder={t('editor.variables.valuePlaceholder')}
            />
            <button
              type="button"
              onClick={() => {
                patch({ globalVariables: globalVariables.filter((_, idx) => idx !== i) });
              }}
              aria-label={t('editor.variables.remove', { index: i + 1 })}
              className="tap rounded-lg p-1.5 text-gray-500 transition-colors hover:text-[var(--color-error)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error)]/40 active:scale-90"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            patch({ globalVariables: [...globalVariables, { name: '', value: '' }] });
          }}
          className="tap inline-flex items-center gap-1.5 rounded-lg bg-foreground/5 px-2.5 py-1.5 text-xs text-gray-600 transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 active:scale-[0.97] dark:text-gray-300"
        >
          <Plus className="h-3.5 w-3.5" /> {t('editor.variables.add')}
        </button>
      </div>
    </div>
  );
};
