import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Monitor } from '@/presentation/components/icons';
import { ShellChrome, ToolDock, type ViewTab } from '@/presentation/components/editor-shell';
import { ColorVariablesProvider } from '@/presentation/components/ui';
import type { Template } from '@/services/templateService';
import { userPartialService } from '@/services/userPartialService';
import { listAvailablePartials } from '@/services/templatePartialService';
import type { StoredPartial } from '@/stores/userPartialStore';
import type { StoredTemplate } from '@/stores/userTemplateStore';
import { useEditorHistory } from '@/hooks/useEditorHistory';
import { useEditorShortcuts } from '@/hooks/useEditorShortcuts';
import { useEditorSectionOps } from '../editor/useEditorSectionOps';
import { toEditorState, SECTION_LABELS, type EditorSection } from '../templateEditorModel';
import { buildEditorTools, nextTool, prevTool } from './editorTools';
import { useEditorSelection, indexAfterReorder } from './useEditorSelection';
import { useSectionSelection } from './useSectionSelection';
import { EditorPanelSwitch } from './EditorPanelSwitch';
import { EditorSceneTimeline } from './EditorSceneTimeline';
import { useProgramMonitor, useTemplatePersistence } from './use-template-editor-shell';
import { ShellTitlebar, ShellMonitor, ShellModals } from './shell-slots';

interface TemplateEditorShellProps {
  initial: Template | null;
  onSaved: (saved: StoredTemplate) => void;
  onCancel: () => void;
  // When provided, a "Save & film →" CTA is shown that saves the template and immediately
  // launches the Builder wizard — skipping the gallery entirely.
  onSaveAndCompile?: (saved: StoredTemplate) => void;
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
// the legacy TemplateEditor (useEditorHistory + useEditorSectionOps), composing them — plus the shell's
// own program-monitor + persistence hooks — into the shared dock·panel·monitor·timeline frame.
// Phone surface tabs for the authoring shell: the editing panel, named for the tool it will show, and
// the program monitor. Built outside the component so it doesn't spend the shell's statement budget.
const buildViewTabs = (
  tools: ReturnType<typeof buildEditorTools>,
  activeTool: string,
  t: (key: string) => string
): [ViewTab, ViewTab] => {
  const active = tools.find((tool) => tool.id === activeTool) ?? tools[0];

  return [
    { id: 'panel', icon: active.icon, label: t(active.labelKey) },
    { id: 'monitor', icon: Monitor, label: t('shell.preview') },
  ];
};

export const TemplateEditorShell = ({ initial, onSaved, onCancel, onSaveAndCompile }: TemplateEditorShellProps) => {
  const { t } = useTranslation('admin');
  const history = useEditorHistory(toEditorState(initial));
  const { state, set, undo, redo, canUndo, canRedo, reset } = history;
  const ops = useEditorSectionOps(set);
  const { patch, patchSection, addSection, removeSection, duplicateSection, reorder, setTransition } = ops;
  const [localPartials] = useState<StoredPartial[]>(() => userPartialService.list());
  const [helpOpen, setHelpOpen] = useState(false);
  // Cold start (building from scratch): offer starter presets before showing the blank editor.
  const [presetsOpen, setPresetsOpen] = useState(initial === null);

  // Selection state for the shell (which tool + which scene), clamped to a valid section index; plus
  // the shared text-overlay selection threaded to both the canvas and the inspector, keyed by scene.
  const [sel, dispatch] = useEditorSelection({ activeTool: 'scenes', selectedIndex: 0 });
  const sectionSelection = useSectionSelection(String(sel.selectedIndex));
  const monitor = useProgramMonitor(state);
  const save = useTemplatePersistence({ state, t, onSaved, onSaveAndCompile });

  useEffect(() => {
    dispatch({ type: 'clamp', count: state.sections.length });
  }, [state.sections.length, dispatch]);

  // All tools shown for now — the Simple/Advanced mode toggle isn't surfaced in the shell yet.
  const tools = buildEditorTools({ advanced: true });
  const selectedSection: EditorSection | null = state.sections[sel.selectedIndex] ?? null;

  const addEditorSection = (kind: EditorSection['kind']): void => {
    addSection(kind);
    dispatch({ type: 'selectScene', index: state.sections.length });
  };

  // Reorder keeps the section you were viewing selected (the preview must NOT jump to the dragged card):
  // re-point the selection at wherever that section lands after the move.
  const reorderScenes = (from: number, to: number): void => {
    reorder(from, to);
    dispatch({ type: 'selectScene', index: indexAfterReorder(sel.selectedIndex, from, to) });
  };

  const selectSceneClamped = (index: number): void => {
    const last = state.sections.length - 1;
    dispatch({ type: 'selectScene', index: Math.max(0, Math.min(index, last)) });
  };

  // Global editor keyboard shortcuts (see useEditorShortcuts). Disabled while the cheat sheet is open so
  // the dialog owns Escape and stray keys don't act on scenes behind it.
  useEditorShortcuts({
    onUndo: undo,
    onRedo: redo,
    onSave: () => {
      if (!save.guardFails) save.handleSave();
    },
    onDeleteScene: () => {
      // While a canvas element is selected, Delete/Backspace belongs to the element (its own focused
      // handlers act on it) — never nuke the whole scene out from under that intent.
      if (sectionSelection.state.element) return;
      removeSection(sel.selectedIndex);
    },
    onDuplicateScene: () => {
      duplicateSection(sel.selectedIndex);
    },
    onAddScene: () => {
      addEditorSection('video');
    },
    onNextScene: () => {
      selectSceneClamped(sel.selectedIndex + 1);
    },
    onPrevScene: () => {
      selectSceneClamped(sel.selectedIndex - 1);
    },
    onNextTool: () => {
      dispatch({ type: 'selectTool', tool: nextTool(tools, sel.activeTool) });
    },
    onPrevTool: () => {
      dispatch({ type: 'selectTool', tool: prevTool(tools, sel.activeTool) });
    },
    onTogglePlay: () => {
      monitor.clock.toggle();
    },
    onShowHelp: () => {
      setHelpOpen(true);
    },
    // The help dialog closes itself on Escape (Radix); this fires with it closed — exit play mode.
    onDismissHelp: () => {
      if (monitor.playMode) monitor.exitPlayMode();
    },
    enabled: !helpOpen && !presetsOpen,
  });

  return (
    // Colour fields anywhere in the shell (panels, inspectors, canvas) resolve and offer the
    // template's {{ variable }} colour tokens through this scope — including the palette's
    // 1-indexed {{ colorN }} slots, so the canvas previews mirror the engine's substitution.
    <ColorVariablesProvider variables={state.globalVariables} colorsList={state.colorsList}>
      <ShellChrome
        resizeLabel={t('shell.resizePanels')}
        viewTabs={buildViewTabs(tools, sel.activeTool, t)}
        viewTabsLabel={t('shell.mobileView')}
        panelFocusKey={`${sel.activeTool}:${String(sel.selectedIndex)}`}
        titlebar={
          <ShellTitlebar
            state={state}
            onNameChange={(value) => {
              patch({ name: value });
            }}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            onCancel={onCancel}
            onSave={save.handleSave}
            saveDisabled={save.guardFails}
            onSaveAndCompile={onSaveAndCompile ? save.handleSaveAndCompile : undefined}
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
              partials={listAvailablePartials(localPartials)}
              patch={patch}
              patchSection={(p) => {
                patchSection(sel.selectedIndex, p);
              }}
              onImport={reset}
              selection={sectionSelection.state}
              onSelectElement={sectionSelection.selectElement}
            />
            {save.error && (
              <p
                role="alert"
                className="border-t border-foreground/10 px-4 py-2 text-xs font-medium text-[var(--color-error)]"
              >
                {save.error}
              </p>
            )}
          </>
        }
        monitor={
          <ShellMonitor
            state={state}
            selectedIndex={sel.selectedIndex}
            selectedSection={selectedSection}
            onPatchSection={(p) => {
              patchSection(sel.selectedIndex, p);
            }}
            selection={sectionSelection.state}
            onSelectElement={sectionSelection.selectElement}
            onBeginEdit={sectionSelection.beginEdit}
            onEndEdit={sectionSelection.endEdit}
            clock={monitor.clock}
            playTimeline={monitor.playTimeline}
            playMode={monitor.playMode}
          />
        }
        timeline={
          <EditorSceneTimeline
            sections={state.sections}
            selectedIndex={sel.selectedIndex}
            onSelect={(i) => {
              // Picking a scene card returns to the edit canvas for that scene.
              if (monitor.playMode) monitor.exitPlayMode();
              dispatch({ type: 'selectScene', index: i });
            }}
            onAdd={addEditorSection}
            onDuplicate={duplicateSection}
            onDelete={removeSection}
            onReorder={reorderScenes}
            onTransition={setTransition}
            defaultTransition={state.defaultTransition}
            sectionTitle={sectionTitle}
            sectionKindLabel={(section) => SECTION_LABELS[section.kind]}
            onBrowsePresets={() => {
              setPresetsOpen(true);
            }}
          />
        }
      />
      <ShellModals
        helpOpen={helpOpen}
        setHelpOpen={setHelpOpen}
        presetsOpen={presetsOpen}
        setPresetsOpen={setPresetsOpen}
        reset={reset}
      />
    </ColorVariablesProvider>
  );
};
