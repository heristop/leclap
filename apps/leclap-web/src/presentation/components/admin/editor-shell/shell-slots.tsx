// The three self-contained slots of TemplateEditorShell's ShellChrome — the titlebar, the program
// monitor (edit canvas or playback), and the help / starter-preset modals — lifted out so the shell
// file stays under its dependency budget. Each is a thin presentational wrapper; the shell owns state.
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

interface ShellTitlebarProps {
  state: EditorState;
  onNameChange: (name: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onCancel: () => void;
  onSave: () => void;
  saveDisabled: boolean;
  onSaveAndCompile?: () => void;
}

export const ShellTitlebar = ({
  state,
  onNameChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onCancel,
  onSave,
  saveDisabled,
  onSaveAndCompile,
}: ShellTitlebarProps) => {
  const { t } = useTranslation('admin');

  return (
    <EditorShellTitlebar
      name={state.name}
      onNameChange={onNameChange}
      canUndo={canUndo}
      canRedo={canRedo}
      onUndo={onUndo}
      onRedo={onRedo}
      onCancel={onCancel}
      onSave={onSave}
      saveDisabled={saveDisabled}
      onSaveAndCompile={onSaveAndCompile}
      preview={<TestRenderButton state={state} disabled={state.sections.length === 0} />}
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
      meta={state.orientation}
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

interface ShellModalsProps {
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
  presetsOpen: boolean;
  setPresetsOpen: (open: boolean) => void;
  reset: (state: EditorState) => void;
}

export const ShellModals = ({ helpOpen, setHelpOpen, presetsOpen, setPresetsOpen, reset }: ShellModalsProps) => (
  <>
    <ShortcutCheatSheet
      open={helpOpen}
      onClose={() => {
        setHelpOpen(false);
      }}
    />
    <StarterPresetPicker
      open={presetsOpen}
      onPick={(preset) => {
        reset(preset.build());
        setPresetsOpen(false);
      }}
      onBlank={() => {
        setPresetsOpen(false);
      }}
    />
  </>
);
