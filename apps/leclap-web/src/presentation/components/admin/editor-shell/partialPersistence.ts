import type { TemplatePartial } from '@leclap/creative-kit/partials';
import { userPartialService } from '@/services/userPartialService';
import { listAvailablePartials, type AvailablePartial } from '@/services/templatePartialService';
import type { StoredPartial } from '@/stores/userPartialStore';
import type { EditorState } from '../templateEditorModel';
import { partialFromDraftState } from '../editor/partialDraft';

export function defaultPartialDraft(): TemplatePartial {
  return {
    id: 'local:new-partial',
    description: 'Local partial',
    sections: [{ name: 'intro', type: 'color_background', options: { duration: 1, backgroundColor: '#111111' } }],
  };
}

// Persists the draft (local partials keep their stored id) and returns the saved partial + refreshed
// local list, so the caller can refresh state and reload the canonical saved copy.
export function persistDraft(
  draftState: EditorState,
  selected: AvailablePartial | null
): { saved: TemplatePartial; localPartials: StoredPartial[] } {
  const id = selected?.source === 'local' ? selected.id : draftState.id;
  const saved = userPartialService.save(partialFromDraftState({ ...draftState, id }));

  return { saved, localPartials: userPartialService.list() };
}

// Removes a local partial and returns the refreshed list + the partial to load next (the first
// remaining one, or a fresh default when none are left). `nextId` is '' for the empty-default case so
// the picker shows no selection, matching a brand-new draft.
export function removePartial(id: string): { localPartials: StoredPartial[]; next: TemplatePartial; nextId: string } {
  userPartialService.remove(id);
  const localPartials = userPartialService.list();
  const fallback = listAvailablePartials(localPartials).at(0);

  if (!fallback) return { localPartials, next: defaultPartialDraft(), nextId: '' };

  return { localPartials, next: fallback, nextId: fallback.id };
}
