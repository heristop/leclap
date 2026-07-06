import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { SectionFields } from '../editor/SectionFields';
import { AudioPanel } from '../editor/AudioPanel';
import { GlobalVariablesEditor } from '../editor/GlobalVariablesEditor';
import { ColorsListEditor } from '../editor/colors-list-editor';
import { WholeVideoAnimations } from '../editor/WholeVideoAnimations';
import { WholeVideoLookGrade } from '../editor/whole-video-look-grade';
import { GlobalOverlaysField } from '../editor/GlobalOverlaysField';
import { DefaultTransitionField } from '../editor/default-transition-field';
import { EditorImportExport } from '../editor/EditorImportExport';
import { EDITOR_INPUT_CLASS } from '../editor/editorStyles';
import type { AvailablePartial } from '@/services/templatePartialService';
import {
  collectVariables,
  renderableSectionNames,
  SECTION_LABELS,
  type EditorSection,
  type EditorState,
} from '../templateEditorModel';
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
// The header is pinned (shrink-0) and compacts on short viewports so the scrollable body keeps as much
// height as possible; overscroll stays contained so panel scroll never chains into the page.
const PanelFrame = ({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) => (
  <div className="flex min-h-0 flex-1 flex-col">
    <header className="shrink-0 border-b border-brand-500/20 bg-brand-500/10 px-4 py-3 [@media(max-height:700px)]:py-2">
      <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-brand-600 dark:text-brand-300">
        {eyebrow}
      </span>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
    </header>
    <div className="panel-swap min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-6 [scrollbar-width:thin] motion-reduce:animate-none [@media(max-height:700px)]:p-3 [@media(max-height:700px)]:pb-5">
      {children}
    </div>
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
      <div className="space-y-4">
        <ColorsListEditor state={state} patch={patch} />
        <WholeVideoLookGrade state={state} patch={patch} />
        <WholeVideoAnimations state={state} patch={patch} />
        <GlobalOverlaysField
          overlays={state.globalOverlays}
          variables={collectVariables(state)}
          sectionNames={renderableSectionNames(state.sections)}
          patch={patch}
        />
        <EditorImportExport state={state} onImport={onImport} />
      </div>
    </PanelFrame>
  );
};

// Name + orientation, mirroring the old editor's BasicsFields but laid out for the narrow shell panel.
// Each orientation option carries a tiny frame glyph (aspect drawn with a border) so the ratios read
// at a glance; the short name below keeps the ratio from being an unlabeled number.
const ORIENTATIONS: ReadonlyArray<{
  value: EditorState['orientation'];
  ratio: string;
  nameKey: string;
  glyphCls: string;
}> = [
  { value: 'landscape', ratio: '16:9', nameKey: 'editor.basics.landscapeShort', glyphCls: 'h-2.5 w-4' },
  { value: 'portrait', ratio: '9:16', nameKey: 'editor.basics.portraitShort', glyphCls: 'h-4 w-2.5' },
  { value: 'square', ratio: '1:1', nameKey: 'editor.basics.squareShort', glyphCls: 'h-3.5 w-3.5' },
];

const BasicsPanel = ({ state, patch }: { state: EditorState; patch: (p: Partial<EditorState>) => void }) => {
  const { t } = useTranslation('admin');
  const nameId = useId();

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor={nameId}
          className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400"
        >
          {t('shell.nameLabel')}
        </label>
        <input
          id={nameId}
          className={EDITOR_INPUT_CLASS}
          value={state.name}
          placeholder={t('editor.basics.namePlaceholder')}
          onChange={(e) => {
            patch({ name: e.target.value });
          }}
        />
      </div>
      <div>
        <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
          {t('editor.basics.orientation')}
        </span>
        <div role="radiogroup" aria-label={t('editor.basics.orientation')} className="grid grid-cols-3 gap-2">
          {ORIENTATIONS.map((option) => {
            const active = state.orientation === option.value;

            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  patch({ orientation: option.value });
                }}
                className={cn(
                  'tap flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                  active
                    ? 'border-brand-500 bg-brand-500/10 text-foreground'
                    : 'border-foreground/15 bg-surface-inset text-muted-foreground hover:border-foreground/30'
                )}
              >
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className={cn(
                      'shrink-0 rounded-[3px] border-2 border-current',
                      option.glyphCls,
                      active ? 'opacity-90' : 'opacity-50'
                    )}
                  />
                  <span className="text-xs font-semibold tabular-nums">{option.ratio}</span>
                </span>
                <span className="text-[0.65rem] font-medium">{t(option.nameKey)}</span>
              </button>
            );
          })}
        </div>
      </div>
      {/* Template-wide default transition (global.transition): what every boundary without its
          own chip renders with. Kept in Basics so it's set once, next to name + orientation. */}
      <DefaultTransitionField
        value={state.defaultTransition}
        onChange={(defaultTransition) => {
          patch({ defaultTransition });
        }}
      />
    </div>
  );
};
