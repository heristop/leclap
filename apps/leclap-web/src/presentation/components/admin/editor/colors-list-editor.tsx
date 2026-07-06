// The template palette editor (EditorState.colorsList): an ordered swatch list whose slots are
// insertable as '{{ colorN }}' tokens in any colour field (the ColorPicker chips) and resolved by
// the engine's FormatterManager at compile time. Lives in the Advanced panel, mirroring the
// Global-variables editor's row chrome.
import { useTranslation } from 'react-i18next';
import { Trash2 } from '@/presentation/components/icons';
import { PlusIcon } from '@/presentation/components/icons/plus';
import { useIconHover } from '@/presentation/components/icons/useIconHover';
import { ColorPicker, ColorVariablesProvider } from '@/presentation/components/ui';
import { BRAND_SWATCHES } from '@/lib/color';
import type { EditorState } from '../templateEditorModel';
import { FieldGroupHeader } from './FieldGroupHeader';

interface ColorsListEditorProps {
  state: EditorState;
  patch: (p: Partial<EditorState>) => void;
}

export const ColorsListEditor = ({ state, patch }: ColorsListEditorProps) => {
  const { t } = useTranslation('admin');
  const { ref: plusRef, hoverProps: plusHoverProps } = useIconHover();
  const palette = state.colorsList ?? [];

  const setPalette = (colorsList: string[]) => {
    patch({ colorsList });
  };

  return (
    <div>
      <FieldGroupHeader label={t('editor.colorsList.label')} hint={t('editor.colorsList.hint')} />
      {/* An EMPTY nested scope keeps the slot pickers literal-only: offering the palette's own
          {{ colorN }} chips here would let a slot reference itself, which the engine never resolves. */}
      <ColorVariablesProvider variables={[]}>
        <div className="space-y-2">
          {palette.map((color, i) => (
            <div key={i} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2">
              <span className="font-mono text-[11px] text-brand-600 dark:text-brand-300">#color{i + 1}</span>
              <ColorPicker
                value={color}
                presets={[]}
                aria-label={t('editor.colorsList.slot', { index: i + 1 })}
                onChange={(value) => {
                  setPalette(palette.map((c, idx) => (idx === i ? value : c)));
                }}
              />
              <button
                type="button"
                onClick={() => {
                  setPalette(palette.filter((_, idx) => idx !== i));
                }}
                aria-label={t('editor.colorsList.remove', { index: i + 1 })}
                className="tap rounded-lg p-1.5 text-gray-500 transition-colors hover:text-[var(--color-error)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error)]/40 active:scale-90"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              // Seed each new slot with the next brand swatch so the palette starts usable, not black.
              setPalette([...palette, BRAND_SWATCHES[palette.length % BRAND_SWATCHES.length]]);
            }}
            className="tap inline-flex items-center gap-1.5 rounded-lg bg-foreground/5 px-2.5 py-1.5 text-xs text-gray-600 transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 active:scale-[0.97] dark:text-gray-300"
            {...plusHoverProps}
          >
            <PlusIcon ref={plusRef} size={14} /> {t('editor.colorsList.add')}
          </button>
        </div>
      </ColorVariablesProvider>
    </div>
  );
};
