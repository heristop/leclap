import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TFunction } from 'i18next';
import type { TemplatePartial } from '@leclap/creative-kit/partials';
import { userPartialService } from '@/services/userPartialService';
import { listAvailablePartials, type AvailablePartial } from '@/services/templatePartialService';
import type { StoredPartial } from '@/stores/userPartialStore';
import type { EditorSection, EditorState } from '../templateEditorModel';
import { draftStateFromPartial } from '../editor/partialDraft';
import { useEditorSectionOps } from '../editor/useEditorSectionOps';
import { useEditorSelection, indexAfterReorder } from './useEditorSelection';
import { defaultPartialDraft, persistDraft, removePartial } from './partialPersistence';

// Partials only expose the scenes + basics tools (no media/format/variables/advanced).
export type PartialToolId = 'scenes' | 'basics';

// All of the partial editor's state + handlers (draft, selection, list, save/delete/new/pick), lifted
// out of PartialEditorShell so the component stays a thin composition. Mirrors PartialsEditor's logic.
export function usePartialEditorState(initialDraft: TemplatePartial | null, t: TFunction<'admin'>) {
  const navigate = useNavigate();
  const [localPartials, setLocalPartials] = useState<StoredPartial[]>(() => userPartialService.list());
  const partials = listAvailablePartials(localPartials);
  const [selectedId, setSelectedId] = useState(() => (initialDraft ? '' : (partials[0]?.id ?? '')));
  const selected: AvailablePartial | null = partials.find((partial) => partial.id === selectedId) ?? null;
  const [draftState, setDraftState] = useState<EditorState>(() =>
    draftStateFromPartial(initialDraft ?? selected ?? defaultPartialDraft())
  );
  const [error, setError] = useState('');
  const ops = useEditorSectionOps(setDraftState);
  const [sel, dispatch] = useEditorSelection({ activeTool: 'scenes', selectedIndex: 0 });

  useEffect(() => {
    dispatch({ type: 'clamp', count: draftState.sections.length });
  }, [draftState.sections.length, dispatch]);

  const activeTool: PartialToolId = sel.activeTool === 'basics' ? 'basics' : 'scenes';

  const loadDraft = (partial: TemplatePartial, nextSelectedId: string): void => {
    setSelectedId(nextSelectedId);
    setDraftState(draftStateFromPartial(partial));
    setError('');
    dispatch({ type: 'selectScene', index: 0 });
  };

  const pickPartial = (partialId: string): void => {
    const partial = partials.find((p) => p.id === partialId);

    if (partial) loadDraft(partial, partial.id);
  };

  const addEditorSection = (kind: EditorSection['kind']): void => {
    ops.addSection(kind);
    dispatch({ type: 'selectScene', index: draftState.sections.length });
  };

  const reorderScenes = (from: number, to: number): void => {
    ops.reorder(from, to);
    dispatch({ type: 'selectScene', index: indexAfterReorder(sel.selectedIndex, from, to) });
  };

  const saveDraft = (): void => {
    try {
      const { saved, localPartials: next } = persistDraft(draftState, selected);
      setLocalPartials(next);
      loadDraft(saved, saved.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('shell.partialSaveFailed'));
    }
  };

  const deleteSelected = (): void => {
    if (selected?.source !== 'local') return;

    const { localPartials: nextLocal, next, nextId } = removePartial(selected.id);
    setLocalPartials(nextLocal);
    loadDraft(next, nextId);
  };

  return {
    partials,
    selected,
    draftState,
    error,
    ops,
    sel,
    dispatch,
    readonly: selected?.readonly === true,
    idLocked: selected?.source === 'local',
    selectedSection: draftState.sections[sel.selectedIndex] ?? null,
    activeTool,
    pickPartial,
    loadNew: () => {
      loadDraft(defaultPartialDraft(), '');
    },
    addEditorSection,
    reorderScenes,
    saveDraft,
    deleteSelected,
    goBack: () => {
      Promise.resolve(navigate('/templates')).catch(() => {});
    },
  };
}
