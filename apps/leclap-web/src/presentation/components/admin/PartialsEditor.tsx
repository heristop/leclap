import { useState } from 'react';
import { AlertCircle, Plus, Save, Trash2 } from 'lucide-react';
import type { TemplatePartial } from '@leclap/creative-kit/partials';
import { userPartialService } from '@/services/userPartialService';
import { listAvailablePartials, type AvailablePartial } from '@/services/templatePartialService';
import { Badge, Button } from '@/presentation/components/ui';
import { cn } from '@/lib/utils';
import { collectVariables, type EditorSection, type EditorState } from './templateEditorModel';
import { AddSectionButtons, SceneList } from './editor/SceneList';
import { EDITOR_INPUT_CLASS } from './editor/editorStyles';
import { draftStateFromPartial, partialFromDraftState } from './editor/partialDraft';
import { groupValidationErrors } from './editor/validationMapping';
import { useEditorSectionOps } from './editor/useEditorSectionOps';

const EDITABLE_PARTIAL_KINDS: readonly EditorSection['kind'][] = ['video', 'form', 'color', 'image'];

interface PartialsEditorProps {
  initialDraft?: TemplatePartial | null;
}

function defaultPartialDraft(): TemplatePartial {
  return {
    id: 'local:new-partial',
    description: 'Local partial',
    sections: [{ name: 'intro', type: 'color_background', options: { duration: 1, backgroundColor: '#111111' } }],
  };
}

// A sidebar item: id, one-line description, a source badge (Local / Built-in) and a section count —
// enough to pick the right partial without opening each one.
const PartialListItem = ({
  partial,
  selected,
  onSelect,
}: {
  partial: AvailablePartial;
  selected: boolean;
  onSelect: () => void;
}) => (
  <button
    type="button"
    onClick={onSelect}
    className={cn(
      'tap w-full rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
      selected ? 'bg-brand-500/15 text-brand-700 dark:text-brand-200' : 'bg-foreground/5 hover:bg-foreground/10'
    )}
  >
    <span className="flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{partial.id}</span>
      <Badge variant={partial.source === 'local' ? 'brand' : 'neutral'} className="shrink-0">
        {partial.source === 'local' ? 'Local' : 'Built-in'}
      </Badge>
    </span>
    {partial.description && (
      <span className="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">{partial.description}</span>
    )}
    <span className="mt-0.5 block text-xs text-gray-400">
      {partial.sections.length} {partial.sections.length === 1 ? 'section' : 'sections'}
    </span>
  </button>
);

export const PartialsEditor = ({ initialDraft = null }: PartialsEditorProps) => {
  const [localPartials, setLocalPartials] = useState(() => userPartialService.list());
  const partials = listAvailablePartials(localPartials);
  const [selectedId, setSelectedId] = useState(() => (initialDraft ? '' : (partials[0]?.id ?? '')));
  const selected = partials.find((partial) => partial.id === selectedId) ?? null;
  const [draftState, setDraftState] = useState<EditorState>(() =>
    draftStateFromPartial(initialDraft ?? selected ?? defaultPartialDraft())
  );
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [error, setError] = useState('');
  const ops = useEditorSectionOps(setDraftState);
  const validation = groupValidationErrors([]);
  const variables = collectVariables(draftState);
  const readonly = selected?.readonly === true;

  const refresh = (nextSelectedId: string): void => {
    const nextLocal = userPartialService.list();
    setLocalPartials(nextLocal);
    setSelectedId(nextSelectedId);
  };

  const loadPartial = (partial: AvailablePartial): void => {
    setSelectedId(partial.id);
    setDraftState(draftStateFromPartial(partial));
    setDragIndex(null);
    setError('');
  };

  const loadNew = (): void => {
    setSelectedId('');
    setDraftState(draftStateFromPartial(defaultPartialDraft()));
    setDragIndex(null);
    setError('');
  };

  const saveDraft = (): void => {
    try {
      const id = selected?.source === 'local' ? selected.id : draftState.id;
      const saved = userPartialService.save(partialFromDraftState({ ...draftState, id }));
      refresh(saved.id);
      setDraftState(draftStateFromPartial(saved));
      setDragIndex(null);
      setError('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save partial.');
    }
  };

  const deleteSelected = (): void => {
    if (selected?.source !== 'local') return;

    userPartialService.remove(selected.id);
    const nextLocal = userPartialService.list();
    const nextPartials = listAvailablePartials(nextLocal);
    setLocalPartials(nextLocal);
    setDragIndex(null);
    setError('');

    if (nextPartials.length === 0) {
      loadNew();

      return;
    }

    const fallback = nextPartials[0];
    setSelectedId(fallback.id);
    setDraftState(draftStateFromPartial(fallback));
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <aside className="space-y-3">
        <Button variant="secondary" type="button" onClick={loadNew} className="w-full justify-start">
          <Plus className="h-4 w-4" /> New local partial
        </Button>
        <div className="space-y-1.5 rounded-xl border border-foreground/10 bg-surface/60 p-2">
          {partials.map((partial) => (
            <PartialListItem
              key={partial.id}
              partial={partial}
              selected={partial.id === selectedId}
              onSelect={() => {
                loadPartial(partial);
              }}
            />
          ))}
        </div>
        {localPartials.length === 0 && (
          <p className="px-1 text-xs text-gray-500 dark:text-gray-400">
            No local partials yet — create one above to reuse across templates.
          </p>
        )}
      </aside>

      <section className="space-y-4">
        {readonly ? (
          <ReadonlyPartial partial={selected} />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-[14rem_1fr]">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                  Id
                </label>
                <input
                  aria-label="Partial id"
                  className={EDITOR_INPUT_CLASS}
                  value={draftState.id}
                  disabled={selected?.source === 'local'}
                  onChange={(e) => {
                    ops.patch({ id: e.target.value, name: e.target.value });
                  }}
                  placeholder="local:intro"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                  Description
                </label>
                <input
                  aria-label="Partial description"
                  className={EDITOR_INPUT_CLASS}
                  value={draftState.description}
                  onChange={(e) => {
                    ops.patch({ description: e.target.value });
                  }}
                  placeholder="Reusable intro"
                />
              </div>
            </div>

            <SceneList
              sections={draftState.sections}
              orientation={draftState.orientation}
              variables={variables}
              dragIndex={dragIndex}
              validation={validation}
              editorState={draftState}
              partials={partials}
              setDragIndex={setDragIndex}
              reorder={ops.reorder}
              removeSection={ops.removeSection}
              duplicateSection={ops.duplicateSection}
              patchSection={ops.patchSection}
              setTransition={ops.setTransition}
              setLayers={ops.setLayers}
            />

            <AddSectionButtons addSection={ops.addSection} kinds={EDITABLE_PARTIAL_KINDS} />
          </>
        )}

        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-3 py-2 text-sm font-medium text-[var(--color-error)]"
          >
            <AlertCircle className="mt-px size-4 shrink-0" /> {error}
          </p>
        )}

        <div className="sticky bottom-0 -mx-4 flex flex-wrap justify-between gap-2 border-t border-foreground/10 bg-background/85 px-4 py-4 backdrop-blur-md pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button variant="secondary" type="button" onClick={loadNew}>
            <Plus className="h-4 w-4" /> New
          </Button>
          <div className="flex gap-2">
            {selected?.source === 'local' && (
              <Button variant="danger" type="button" onClick={deleteSelected}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
            <Button variant="primary" type="button" onClick={saveDraft} disabled={readonly}>
              <Save className="h-4 w-4" /> Save partial
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

const ReadonlyPartial = ({ partial }: { partial: AvailablePartial }) => (
  <div className="space-y-3">
    <div className="rounded-xl border border-foreground/10 bg-foreground/5 px-3 py-2">
      <p className="text-sm font-semibold text-foreground">{partial.id}</p>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{partial.description}</p>
    </div>
    <div className="space-y-2">
      {partial.sections.map((section, index) => (
        <div
          key={`${section.name ?? 'section'}-${index}`}
          className="flex items-center gap-2 rounded-lg border border-foreground/10 bg-surface-2/60 px-3 py-2"
        >
          <span
            className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-500/15 text-[11px] font-bold tabular-nums text-brand-700 dark:text-brand-300"
            aria-hidden
          >
            {index + 1}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
            {typeof section.name === 'string' ? section.name : `section_${index + 1}`}
          </span>
          <span className="shrink-0 rounded-md bg-foreground/5 px-2 py-1 text-xs text-gray-500 dark:text-gray-400">
            {section.type}
          </span>
        </div>
      ))}
    </div>
  </div>
);
