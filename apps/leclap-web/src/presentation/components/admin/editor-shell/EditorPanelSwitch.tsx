import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionFields } from '../editor/SectionFields';
import { AudioPanel } from '../editor/AudioPanel';
import { GlobalVariablesEditor } from '../editor/GlobalVariablesEditor';
import { WholeVideoAnimations } from '../editor/WholeVideoAnimations';
import { EditorImportExport } from '../editor/EditorImportExport';
import { EDITOR_INPUT_CLASS } from '../editor/editorStyles';
import type { AvailablePartial } from '@/services/templatePartialService';
import { collectVariables, SECTION_LABELS, type EditorSection, type EditorState } from '../templateEditorModel';
import type { EditorToolId } from './editorTools';
import { addableKinds } from './AddElementMenu';
import { ElementBlock } from './ElementBlock';
import type { ElementRef, SectionSelectionState } from './useSectionSelection';

// True when the section owns any addable visual element (video/color/image), so the left panel hosts
// the unified Add menu + element list + inspector below the section-level fields.
const hasElements = (section: EditorSection): boolean => addableKinds(section).length > 0;

interface EditorPanelSwitchProps {
  activeTool: EditorToolId;
  state: EditorState;
  section: EditorSection | null;
  partials: AvailablePartial[];
  patch: (p: Partial<EditorState>) => void;
  patchSection: (p: Partial<EditorSection>) => void;
  onImport: (next: EditorState) => void;
  selection: SectionSelectionState;
  onSelectElement: (ref: ElementRef | null) => void;
}

// A panel shell: an eyebrow + title header above a swap-animated body, matching the studio panel chrome.
const PanelFrame = ({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) => (
  <div className="flex min-h-0 flex-1 flex-col">
    <header className="border-b border-foreground/10 px-4 py-3">
      <span className="block text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-brand-600/70 dark:text-brand-300/60">
        {eyebrow}
      </span>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
    </header>
    <div className="panel-swap min-h-0 flex-1 overflow-y-auto p-4 motion-reduce:animate-none">{children}</div>
  </div>
);

// A muted placeholder body for panels whose authoring UI isn't wired into the shell yet.
const PanelPlaceholder = ({ message }: { message: string }) => (
  <p className="text-sm text-muted-foreground">{message}</p>
);

// The active tool's panel body. Early returns, no else: scenes → the selected section's fields; basics →
// name + orientation; audio → the global mix; variables/advanced → placeholders (refined later phase).
export const EditorPanelSwitch = ({
  activeTool,
  state,
  section,
  partials,
  patch,
  patchSection,
  onImport,
  selection,
  onSelectElement,
}: EditorPanelSwitchProps) => {
  const { t } = useTranslation('admin');

  if (activeTool === 'scenes') {
    if (!section) {
      return (
        <PanelFrame eyebrow={t('shell.tools')} title={t('shell.scenes')}>
          <PanelPlaceholder message={t('shell.monitorEmpty')} />
        </PanelFrame>
      );
    }

    return (
      <PanelFrame eyebrow={t('shell.scenes')} title={SECTION_LABELS[section.kind]}>
        <SectionFields
          section={section}
          orientation={state.orientation}
          variables={collectVariables(state)}
          partials={partials}
          onChange={patchSection}
          inputCls={EDITOR_INPUT_CLASS}
        />
        {hasElements(section) && (
          <ElementBlock
            state={state}
            section={section}
            selection={selection}
            patchSection={patchSection}
            onSelectElement={onSelectElement}
          />
        )}
      </PanelFrame>
    );
  }

  if (activeTool === 'basics') {
    return (
      <PanelFrame eyebrow={t('shell.tools')} title={t('shell.basics')}>
        <BasicsPanel state={state} patch={patch} />
      </PanelFrame>
    );
  }

  if (activeTool === 'audio') {
    return (
      <PanelFrame eyebrow={t('shell.tools')} title={t('shell.audio')}>
        <AudioPanel
          audio={state.audio}
          onChange={(audio) => {
            patch({ audio });
          }}
        />
      </PanelFrame>
    );
  }

  if (activeTool === 'variables') {
    return (
      <PanelFrame eyebrow={t('shell.tools')} title={t('shell.variables')}>
        <GlobalVariablesEditor state={state} patch={patch} />
      </PanelFrame>
    );
  }

  return (
    <PanelFrame eyebrow={t('shell.tools')} title={t('shell.advanced')}>
      <div className="space-y-2">
        <WholeVideoAnimations state={state} patch={patch} />
        <EditorImportExport state={state} onImport={onImport} />
      </div>
    </PanelFrame>
  );
};

// Name + orientation, mirroring the old editor's BasicsFields but laid out for the narrow shell panel.
const ORIENTATIONS: ReadonlyArray<{ value: EditorState['orientation']; label: string }> = [
  { value: 'landscape', label: '16:9' },
  { value: 'portrait', label: '9:16' },
  { value: 'square', label: '1:1' },
];

const BasicsPanel = ({ state, patch }: { state: EditorState; patch: (p: Partial<EditorState>) => void }) => {
  const { t } = useTranslation('admin');

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t('shell.basics')}
        </label>
        <input
          className={EDITOR_INPUT_CLASS}
          value={state.name}
          placeholder="My template"
          onChange={(e) => {
            patch({ name: e.target.value });
          }}
        />
      </div>
      <div>
        <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {state.orientation}
        </span>
        <div role="radiogroup" className="grid grid-cols-3 gap-2">
          {ORIENTATIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={state.orientation === option.value}
              onClick={() => {
                patch({ orientation: option.value });
              }}
              className={
                state.orientation === option.value
                  ? 'rounded-lg border border-brand-500 bg-brand-500/10 px-2 py-2 text-xs font-semibold text-foreground'
                  : 'rounded-lg border border-foreground/15 bg-surface-inset px-2 py-2 text-xs font-semibold text-muted-foreground hover:border-foreground/30'
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
