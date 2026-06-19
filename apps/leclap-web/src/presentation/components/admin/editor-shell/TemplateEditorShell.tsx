import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShellChrome, ToolDock, ProgramMonitor } from '@/presentation/components/editor-shell';
import { templateService, type Template } from '@/services/templateService';
import { userTemplateService } from '@/services/userTemplateService';
import { userPartialService } from '@/services/userPartialService';
import { listAvailablePartials } from '@/services/templatePartialService';
import type { StoredPartial } from '@/stores/userPartialStore';
import { useEditorHistory } from '@/hooks/useEditorHistory';
import { useEditorSectionOps } from '../editor/useEditorSectionOps';
import {
  buildDescriptor,
  toEditorState,
  SECTION_LABELS,
  type EditorSection,
  type EditorState,
} from '../templateEditorModel';
import { TestRenderButton } from '../editor/TestRenderButton';
import { buildEditorTools } from './editorTools';
import { useEditorSelection } from './useEditorSelection';
import { EditorShellTitlebar } from './EditorShellTitlebar';
import { EditorPanelSwitch } from './EditorPanelSwitch';
import { EditorMonitor } from './EditorMonitor';
import { EditorSceneTimeline } from './EditorSceneTimeline';

interface TemplateEditorShellProps {
  initial: Template | null;
  onSaved: () => void;
  onCancel: () => void;
}

// Save guard mirroring TemplateEditor's saveGuardError: name + at least one section + media-or-upload.
// Returns true when the template is NOT yet safe to save.
function saveGuardFails(state: EditorState): boolean {
  if (state.name.trim() === '') return true;

  if (state.sections.length === 0) return true;

  const emptyMedia = state.sections.find(
    (s) => (s.kind === 'music' || s.kind === 'image') && s.allowed.length === 0 && !s.allowUpload
  );

  return Boolean(emptyMedia);
}

// Editor state -> persisted user Template (same projection as TemplateEditor.toUserTemplate).
function toUserTemplate(state: EditorState): Template {
  const descriptor = buildDescriptor(state);

  return {
    id: state.id,
    name: state.name.trim(),
    description: state.description.trim(),
    orientation: state.orientation,
    hasForm: templateService.extractFormFields(descriptor).length > 0,
    complexity: templateService.getTemplateComplexity(descriptor),
    source: 'user',
    descriptor,
  };
}

// A readable cell title: a video section's first non-empty overlay, else the kind label.
function sectionTitle(section: EditorSection): string {
  if (section.kind === 'video') {
    const text = section.overlays.find((o) => o.text.trim() !== '')?.text.trim();

    if (text) return text;
  }

  return SECTION_LABELS[section.kind];
}

// The template-authoring editor re-housed inside the studio shell. Reuses the exact same state hooks as
// the legacy TemplateEditor (useEditorHistory + useEditorSectionOps), composing them into the shared
// dock·panel·monitor·timeline frame. The legacy TemplateEditor stays in place; this is the new shell.
export const TemplateEditorShell = ({ initial, onSaved, onCancel }: TemplateEditorShellProps) => {
  const { t } = useTranslation('admin');
  const history = useEditorHistory(toEditorState(initial));
  const { state, set, undo, redo, canUndo, canRedo, reset } = history;
  const ops = useEditorSectionOps(set);
  const { patch, patchSection, addSection, removeSection, duplicateSection, reorder, setTransition, setLayers } = ops;
  const [localPartials] = useState<StoredPartial[]>(() => userPartialService.list());
  const [error, setError] = useState('');
  const partials = listAvailablePartials(localPartials);

  // Selection state for the shell (which tool + which scene), clamped to a valid section index.
  const [sel, dispatch] = useEditorSelection({ activeTool: 'scenes', selectedIndex: 0 });

  useEffect(() => {
    dispatch({ type: 'clamp', count: state.sections.length });
  }, [state.sections.length, dispatch]);

  // All tools shown for now — the Simple/Advanced mode toggle isn't surfaced in the shell yet.
  const tools = buildEditorTools({ advanced: true });
  const selectedSection: EditorSection | null = state.sections[sel.selectedIndex] ?? null;
  const guardFails = saveGuardFails(state);

  const addEditorSection = (kind: EditorSection['kind']): void => {
    addSection(kind);
    dispatch({ type: 'selectScene', index: state.sections.length });
  };

  // Reorder keeps the moved section selected: it lands at `to` (the original `reorder` semantics shift
  // intervening indices), so re-point the selection at `to` after the op.
  const reorderScenes = (from: number, to: number): void => {
    reorder(from, to);
    dispatch({ type: 'selectScene', index: to });
  };

  const handleSave = (): void => {
    if (saveGuardFails(state)) return;

    setError('');

    try {
      userTemplateService.save(toUserTemplate(state));
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('validation.saveFailed'));
    }
  };

  return (
    <ShellChrome
      titlebar={
        <EditorShellTitlebar
          name={state.name}
          onNameChange={(value) => {
            patch({ name: value });
          }}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          onCancel={onCancel}
          onSave={handleSave}
          saveDisabled={guardFails}
          preview={<TestRenderButton state={state} disabled={state.sections.length === 0} />}
          t={t}
        />
      }
      dock={
        <ToolDock
          items={tools.map((tool) => ({ id: tool.id, icon: tool.icon, label: t(tool.labelKey) }))}
          active={sel.activeTool}
          onSelect={(id) => {
            dispatch({ type: 'selectTool', tool: id });
          }}
          ariaLabel={t('shell.tools')}
        />
      }
      panel={
        <>
          <EditorPanelSwitch
            activeTool={sel.activeTool}
            state={state}
            section={selectedSection}
            partials={partials}
            patch={patch}
            patchSection={(p) => {
              patchSection(sel.selectedIndex, p);
            }}
            setLayers={(layers) => {
              setLayers(sel.selectedIndex, layers);
            }}
            onImport={reset}
          />
          {error && (
            <p
              role="alert"
              className="border-t border-foreground/10 px-4 py-2 text-xs font-medium text-[var(--color-error)]"
            >
              {error}
            </p>
          )}
        </>
      }
      monitor={
        <ProgramMonitor label={t('shell.preview')} meta={state.orientation} swapKey={String(sel.selectedIndex)}>
          <EditorMonitor
            state={state}
            section={selectedSection}
            onPatchSection={(p) => {
              patchSection(sel.selectedIndex, p);
            }}
          />
        </ProgramMonitor>
      }
      timeline={
        <EditorSceneTimeline
          sections={state.sections}
          selectedIndex={sel.selectedIndex}
          onSelect={(i) => {
            dispatch({ type: 'selectScene', index: i });
          }}
          onAdd={addEditorSection}
          onDuplicate={duplicateSection}
          onDelete={removeSection}
          onReorder={reorderScenes}
          onTransition={setTransition}
          sectionTitle={sectionTitle}
          sectionKindLabel={(section) => SECTION_LABELS[section.kind]}
        />
      }
    />
  );
};
