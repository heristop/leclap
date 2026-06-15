import {
  patch as patchOp,
  patchSection as patchSectionOp,
  addSection as addSectionOp,
  removeSection as removeSectionOp,
  reorderSection as reorderSectionOp,
  duplicateSection as duplicateSectionOp,
  patchLayers,
  setTransitionAfter,
  type BackgroundLayer,
  type EditorSection,
  type EditorState,
  type SectionTransition,
} from '../templateEditorModel';

type SetState = (next: EditorState | ((current: EditorState) => EditorState)) => void;

// Section/state mutation handlers, each wrapping a shared pure op so callers can
// plug in either React state or undo-history state.
export function useEditorSectionOps(set: SetState) {
  return {
    patch: (p: Partial<EditorState>) => {
      set((s) => patchOp(s, p));
    },
    patchSection: (i: number, p: Partial<EditorSection>) => {
      set((s) => patchSectionOp(s, i, p));
    },
    addSection: (kind: EditorSection['kind'], initial?: Partial<EditorSection>) => {
      set((s) => {
        const next = addSectionOp(s, kind);

        if (!initial) return next;

        return patchSectionOp(next, next.sections.length - 1, initial);
      });
    },
    removeSection: (i: number) => {
      set((s) => removeSectionOp(s, i));
    },
    duplicateSection: (i: number) => {
      set((s) => duplicateSectionOp(s, i));
    },
    reorder: (from: number, to: number) => {
      if (from === to) return;
      set((s) => reorderSectionOp(s, from, to));
    },
    setTransition: (i: number, transition: SectionTransition | undefined) => {
      set((s) => setTransitionAfter(s, i, transition));
    },
    setLayers: (i: number, layers: BackgroundLayer[]) => {
      set((s) => patchLayers(s, i, layers));
    },
  };
}
