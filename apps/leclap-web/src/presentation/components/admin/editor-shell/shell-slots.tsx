// The three self-contained slots of TemplateEditorShell's ShellChrome — the titlebar, the program
// monitor (edit canvas or playback), and the help / starter-preset modals — lifted out so the shell
// file stays under its dependency budget. Each is a thin presentational wrapper; the shell owns state.
import { useState, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { ProgramMonitor } from '@/presentation/components/editor-shell';
import type { EditorSection, EditorState } from '../templateEditorModel';
import { TestRenderButton } from '../editor/TestRenderButton';
import { EditorShellTitlebar } from './EditorShellTitlebar';
import { EditorMonitor } from './EditorMonitor';
import { ShortcutCheatSheet } from './ShortcutCheatSheet';
import { StarterPresetPicker } from './StarterPresetPicker';
import type { Segment } from './program-timeline.logic';
import type { ProgramClock } from './use-program-clock';
import { ProgramPlayer } from './program-player';
import { ProgramTransport } from './program-transport';
import type { ElementRef, SectionSelectionState } from './useSectionSelection';
import type { SaveFeedback } from './save-blocker.logic';
import { GenerateWithAiButton, LazyGenerateWithAiDialog } from '../ai-generate/AiAssist';

interface ShellTitlebarProps {
  state: EditorState;
  onNameChange: (name: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onCancel: () => void;
  backLabel?: string;
  onSave: () => void;
  onSaveAndCompile?: () => void;
  feedback: SaveFeedback | null;
  nameInvalid: boolean;
  nameRef: Ref<HTMLInputElement>;
  // Opens Generate with AI; the titlebar shows its button only when given.
  onGenerate?: () => void;
}

export const ShellTitlebar = ({
  state,
  onNameChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onCancel,
  backLabel,
  onSave,
  onSaveAndCompile,
  feedback,
  nameInvalid,
  nameRef,
  onGenerate,
}: ShellTitlebarProps) => {
  const { t } = useTranslation('admin');
  const { t: tAi } = useTranslation('ai');

  return (
    <EditorShellTitlebar
      name={state.name}
      onNameChange={onNameChange}
      canUndo={canUndo}
      canRedo={canRedo}
      onUndo={onUndo}
      onRedo={onRedo}
      onCancel={onCancel}
      backLabel={backLabel}
      onSave={onSave}
      onSaveAndCompile={onSaveAndCompile}
      feedback={feedback}
      nameInvalid={nameInvalid}
      nameRef={nameRef}
      preview={<TestRenderButton state={state} disabled={state.sections.length === 0} />}
      assist={onGenerate ? <GenerateWithAiButton onClick={onGenerate} t={tAi} /> : undefined}
      t={t}
    />
  );
};

interface ShellMonitorProps {
  state: EditorState;
  selectedIndex: number;
  selectedSection: EditorSection | null;
  onPatchSection: (patch: Partial<EditorSection>) => void;
  selection: SectionSelectionState;
  onSelectElement: (ref: ElementRef | null) => void;
  onBeginEdit: () => void;
  onEndEdit: () => void;
  clock: ProgramClock;
  playTimeline: Segment[];
  playMode: boolean;
}

// Play mode swaps the WYSIWYG edit canvas for the playback surface; the transport only shows once
// there is a non-empty timeline to scrub.
export const ShellMonitor = ({
  state,
  selectedIndex,
  selectedSection,
  onPatchSection,
  selection,
  onSelectElement,
  onBeginEdit,
  onEndEdit,
  clock,
  playTimeline,
  playMode,
}: ShellMonitorProps) => {
  const { t } = useTranslation('admin');

  return (
    <ProgramMonitor
      label={playMode ? t('monitor.playing') : t('shell.preview')}
      meta={t(`orientationLabel.${state.orientation}`)}
      swapKey={playMode ? 'play' : String(selectedIndex)}
      transport={playTimeline.length > 0 ? <ProgramTransport clock={clock} timeline={playTimeline} /> : undefined}
    >
      {playMode ? (
        <ProgramPlayer state={state} clock={clock} timeline={playTimeline} />
      ) : (
        <EditorMonitor
          state={state}
          section={selectedSection}
          onPatchSection={onPatchSection}
          selection={selection}
          onSelectElement={onSelectElement}
          onBeginEdit={onBeginEdit}
          onEndEdit={onEndEdit}
        />
      )}
    </ProgramMonitor>
  );
};

export interface ShellModalState {
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
  presetsOpen: boolean;
  setPresetsOpen: (open: boolean) => void;
  aiOpen: boolean;
  setAiOpen: (open: boolean) => void;
  // Any modal open: the editor's global shortcuts stand down so keys act on the dialog.
  anyOpen: boolean;
}

export function useShellModals(presetsInitiallyOpen: boolean): ShellModalState {
  const [helpOpen, setHelpOpen] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(presetsInitiallyOpen);
  const [aiOpen, setAiOpen] = useState(false);

  return {
    helpOpen,
    setHelpOpen,
    presetsOpen,
    setPresetsOpen,
    aiOpen,
    setAiOpen,
    anyOpen: helpOpen || presetsOpen || aiOpen,
  };
}

interface ShellModalsProps {
  modals: ShellModalState;
  reset: (state: EditorState) => void;
  // The draft has edits: loading a generated template asks before replacing it.
  canUndo: boolean;
}

export const ShellModals = ({ modals, reset, canUndo }: ShellModalsProps) => (
  <>
    <ShortcutCheatSheet
      open={modals.helpOpen}
      onClose={() => {
        modals.setHelpOpen(false);
      }}
    />
    <StarterPresetPicker
      open={modals.presetsOpen}
      onPick={(preset) => {
        reset(preset.build());
        modals.setPresetsOpen(false);
      }}
      onBlank={() => {
        modals.setPresetsOpen(false);
      }}
      onGenerate={() => {
        modals.setPresetsOpen(false);
        modals.setAiOpen(true);
      }}
    />
    <LazyGenerateWithAiDialog
      open={modals.aiOpen}
      onOpenChange={modals.setAiOpen}
      hasUnsavedWork={canUndo}
      onLoad={reset}
    />
  </>
);
