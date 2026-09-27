import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { DefaultTransitionField } from '../editor/default-transition-field';
import { EDITOR_INPUT_CLASS } from '../editor/editorStyles';
import type { EditorState } from '../templateEditorModel';

// Name + orientation, mirroring the old editor's BasicsFields but laid out for the narrow shell panel.
// Each orientation option carries a tiny frame glyph (aspect drawn with a border) so the ratios read
// at a glance; the short name below keeps the ratio from being an unlabeled number.
const ORIENTATIONS: ReadonlyArray<{
  value: EditorState['orientation'];
  ratio: string;
  nameKey: string;
  glyphCls: string;
}> = [
  { value: 'landscape', ratio: '16:9', nameKey: 'editor.basics.landscapeShort', glyphCls: 'h-2.5 w-4' },
  { value: 'portrait', ratio: '9:16', nameKey: 'editor.basics.portraitShort', glyphCls: 'h-4 w-2.5' },
  { value: 'square', ratio: '1:1', nameKey: 'editor.basics.squareShort', glyphCls: 'h-3.5 w-3.5' },
];

export const BasicsPanel = ({ state, patch }: { state: EditorState; patch: (p: Partial<EditorState>) => void }) => {
  const { t } = useTranslation('admin');
  const nameId = useId();

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor={nameId}
          className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400"
        >
          {t('shell.nameLabel')}
        </label>
        <input
          id={nameId}
          className={EDITOR_INPUT_CLASS}
          value={state.name}
          placeholder={t('editor.basics.namePlaceholder')}
          onChange={(e) => {
            patch({ name: e.target.value });
          }}
        />
      </div>
      <div>
        <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
          {t('editor.basics.orientation')}
        </span>
        <div role="radiogroup" aria-label={t('editor.basics.orientation')} className="grid grid-cols-3 gap-2">
          {ORIENTATIONS.map((option) => {
            const active = state.orientation === option.value;

            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  patch({ orientation: option.value });
                }}
                className={cn(
                  'tap flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                  active
                    ? 'border-brand-500 bg-brand-500/10 text-foreground'
                    : 'border-foreground/15 bg-surface-inset text-muted-foreground hover:border-foreground/30'
                )}
              >
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className={cn(
                      'shrink-0 rounded-[3px] border-2 border-current',
                      option.glyphCls,
                      active ? 'opacity-90' : 'opacity-50'
                    )}
                  />
                  <span className="text-xs font-semibold tabular-nums">{option.ratio}</span>
                </span>
                <span className="text-[0.65rem] font-medium">{t(option.nameKey)}</span>
              </button>
            );
          })}
        </div>
      </div>
      {/* Template-wide default transition (global.transition): what every boundary without its
          own chip renders with. Kept in Basics so it's set once, next to name + orientation. */}
      <DefaultTransitionField
        value={state.defaultTransition}
        onChange={(defaultTransition) => {
          patch({ defaultTransition });
        }}
      />
    </div>
  );
};
