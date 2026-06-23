import { useTranslation } from 'react-i18next';
import { LayersIcon } from '@/presentation/components/icons/layers';
import { FileTextIcon } from '@/presentation/components/icons/file-text';
import type { TemplatePartial } from '@leclap/creative-kit/partials';
import { ShellChrome, ToolDock, ProgramMonitor } from '@/presentation/components/editor-shell';
import { SECTION_LABELS, type EditorSection } from '../templateEditorModel';
import { EditorMonitor } from './EditorMonitor';
import { EditorSceneTimeline } from './EditorSceneTimeline';
import { PartialTitlebar } from './PartialTitlebar';
import { PartialPanelSwitch } from './PartialPanelSwitch';
import { usePartialEditorState } from './usePartialEditorState';
import { useSectionSelection } from './useSectionSelection';

const EDITABLE_PARTIAL_KINDS: readonly EditorSection['kind'][] = ['video', 'form', 'color', 'image'];

interface PartialEditorShellProps {
  initialDraft?: TemplatePartial | null;
}

const sectionTitle = (section: EditorSection): string => {
  if (section.kind === 'video') {
    const text = section.overlays.find((o) => o.text.trim() !== '')?.text.trim();

    if (text) return text;
  }

  return SECTION_LABELS[section.kind];
};

// The partials authoring editor re-housed in the same studio shell as the template creator. Reuses the
// editor-shell kit (ShellChrome · ToolDock · ProgramMonitor · EditorMonitor · EditorSceneTimeline) and
// the partial draft state (via usePartialEditorState), composing them into the shared
// dock·panel·monitor·timeline frame. Built-ins are read-only; the titlebar owns picker/new/delete/save.
export const PartialEditorShell = ({ initialDraft = null }: PartialEditorShellProps) => {
  const { t } = useTranslation('admin');
  const editor = usePartialEditorState(initialDraft, t);
  const { draftState, sel, ops, dispatch } = editor;

  // Shared text-overlay selection for the current section, threaded to the center canvas and the left
  // inspector (the same lift as the template shell). Keyed by section index so it resets on scene swap.
  const sectionSelection = useSectionSelection(String(sel.selectedIndex));

  const tools = [
    { id: 'scenes' as const, icon: LayersIcon, label: t('shell.scenes') },
    { id: 'basics' as const, icon: FileTextIcon, label: t('shell.basics') },
  ];

  return (
    <ShellChrome
      resizeLabel={t('shell.resizePanels')}
      titlebar={
        <PartialTitlebar
          id={draftState.id}
          selected={editor.selected}
          partials={editor.partials}
          readonly={editor.readonly}
          idLocked={editor.idLocked}
          onIdChange={(value) => {
            ops.patch({ id: value, name: value });
          }}
          onPick={editor.pickPartial}
          onNew={editor.loadNew}
          onDelete={editor.deleteSelected}
          onSave={editor.saveDraft}
          onBack={editor.goBack}
          t={t}
        />
      }
      dock={
        <ToolDock
          items={tools}
          active={editor.activeTool}
          onSelect={(id) => {
            dispatch({ type: 'selectTool', tool: id });
          }}
          ariaLabel={t('shell.tools')}
        />
      }
      panel={
        <>
          <PartialPanelSwitch
            activeTool={editor.activeTool}
            state={draftState}
            section={editor.selectedSection}
            partials={editor.partials}
            readonly={editor.readonly}
            idLocked={editor.idLocked}
            patch={ops.patch}
            patchSection={(p) => {
              ops.patchSection(sel.selectedIndex, p);
            }}
            selection={sectionSelection.state}
            onSelectElement={sectionSelection.selectElement}
          />
          {editor.error && (
            <p
              role="alert"
              className="border-t border-foreground/10 px-4 py-2 text-xs font-medium text-[var(--color-error)]"
            >
              {editor.error}
            </p>
          )}
        </>
      }
      monitor={
        <ProgramMonitor label={t('shell.preview')} meta={draftState.orientation} swapKey={String(sel.selectedIndex)}>
          <EditorMonitor
            state={draftState}
            section={editor.selectedSection}
            onPatchSection={(p) => {
              ops.patchSection(sel.selectedIndex, p);
            }}
            selection={sectionSelection.state}
            onSelectElement={sectionSelection.selectElement}
            onBeginEdit={sectionSelection.beginEdit}
            onEndEdit={sectionSelection.endEdit}
          />
        </ProgramMonitor>
      }
      timeline={
        <EditorSceneTimeline
          sections={draftState.sections}
          selectedIndex={sel.selectedIndex}
          onSelect={(i) => {
            dispatch({ type: 'selectScene', index: i });
          }}
          onAdd={editor.addEditorSection}
          onDuplicate={ops.duplicateSection}
          onDelete={ops.removeSection}
          onReorder={editor.reorderScenes}
          onTransition={ops.setTransition}
          sectionTitle={sectionTitle}
          sectionKindLabel={(section) => SECTION_LABELS[section.kind]}
          addKinds={EDITABLE_PARTIAL_KINDS}
        />
      }
    />
  );
};
