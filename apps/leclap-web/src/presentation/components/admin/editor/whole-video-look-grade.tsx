// Whole-video colour treatment (descriptor global.look / global.grade) — baked into EVERY section's
// base frame after its own look/grade (SegmentBuilder.injectSugarFilters → compileGlobalDecorations),
// so one pick here grades the entire video. Reuses the section-level LookGallery + GradePanel wired
// to EditorState.globalLook / globalGrade, matching the WholeVideoAnimations Advanced-panel pattern.
import { useTranslation } from 'react-i18next';
import type { EditorState } from '../templateEditorModel';
import { LookGallery } from './LookGallery';
import { GradePanel } from './GradePanel';

interface WholeVideoLookGradeProps {
  state: EditorState;
  patch: (p: Partial<EditorState>) => void;
}

export const WholeVideoLookGrade = ({ state, patch }: WholeVideoLookGradeProps) => {
  const { t } = useTranslation('admin');

  return (
    <div className="mt-4 border-t border-foreground/10 pt-4">
      <span className="block text-xs font-semibold uppercase tracking-widest text-gray-400">
        {t('editor.advanced.wholeVideoLook.label')}
      </span>
      <p className="mt-1 mb-3 text-xs text-gray-500">{t('editor.advanced.wholeVideoLook.hint')}</p>
      <div className="space-y-3">
        <LookGallery
          look={state.globalLook}
          onChange={(look) => {
            patch({ globalLook: look });
          }}
        />
        <GradePanel
          grade={state.globalGrade}
          onChange={(grade) => {
            patch({ globalGrade: grade });
          }}
        />
      </div>
    </div>
  );
};
