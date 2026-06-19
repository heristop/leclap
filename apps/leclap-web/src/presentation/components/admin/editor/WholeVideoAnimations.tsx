// Whole-video animation overlays (descriptor global.animations) — composited over the FINAL joined video
// so they span every section continuously, unlike a section's own animation. Reuses the section animation
// list editor. Extracted from TemplateEditor so the studio shell's Advanced panel renders the same UI.
import { useTranslation } from 'react-i18next';
import type { EditorState } from '../templateEditorModel';
import { AnimationOverlayField } from './AnimationOverlayField';

interface WholeVideoAnimationsProps {
  state: EditorState;
  patch: (p: Partial<EditorState>) => void;
}

export const WholeVideoAnimations = ({ state, patch }: WholeVideoAnimationsProps) => {
  const { t } = useTranslation('admin');

  return (
    <div className="mt-4 border-t border-foreground/10 pt-4">
      <span className="block text-xs font-semibold uppercase tracking-widest text-gray-400">
        {t('editor.advanced.wholeVideo.label')}
      </span>
      <p className="mt-1 mb-3 text-xs text-gray-500">{t('editor.advanced.wholeVideo.hint')}</p>
      <AnimationOverlayField
        value={state.globalAnimations}
        orientation={state.orientation}
        onChange={(animations) => {
          patch({ globalAnimations: animations ?? [] });
        }}
      />
    </div>
  );
};
